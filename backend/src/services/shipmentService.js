const { pool, query } = require("../db");
const { publishRealtimeEvent } = require("../realtime/eventBus");
const { REALTIME_EVENT_TYPES } = require("../realtime/eventTypes");
const { enqueueIntegrationEvent } = require("../queue/integrationQueue");
const { INTEGRATION_EVENTS } = require("../integrations/integrationEvents");

const DEFAULT_PACK_BASE_TIME_SECONDS = 60;
const DEFAULT_PACK_TIME_PER_LINE_SECONDS = 20;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Called asynchronously after a pick task completes.
 * Creates a pack task (same source_document_id, same SKU lines) and a
 * pending shipment record linked to the pick's sales order.
 */
const onPickTaskCompleted = async (pickTaskId) => {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    // Fetch pick task metadata
    const taskResult = await client.query(
      `SELECT source_document_id, priority FROM tasks WHERE id = $1`,
      [pickTaskId]
    );
    if (taskResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return;
    }
    const pickTask = taskResult.rows[0];

    // Fetch pick task lines
    const linesResult = await client.query(
      `SELECT sku_id, quantity FROM task_lines WHERE task_id = $1`,
      [pickTaskId]
    );
    const lines = linesResult.rows;
    if (lines.length === 0) {
      await client.query("ROLLBACK");
      return;
    }

    const estimatedTimeSeconds =
      DEFAULT_PACK_BASE_TIME_SECONDS + lines.length * DEFAULT_PACK_TIME_PER_LINE_SECONDS;

    // Create pack task
    const packTaskResult = await client.query(
      `INSERT INTO tasks (type, priority, status, source_document_id, estimated_time_seconds)
       VALUES ('pack'::task_type, $1, 'created'::task_status, $2, $3)
       RETURNING id`,
      [pickTask.priority, pickTask.source_document_id, estimatedTimeSeconds]
    );
    const packTaskId = packTaskResult.rows[0].id;

    // Create pack task lines (same SKUs/quantities — no location context needed)
    for (const line of lines) {
      await client.query(
        `INSERT INTO task_lines (task_id, sku_id, quantity) VALUES ($1, $2, $3)`,
        [packTaskId, line.sku_id, line.quantity]
      );
    }

    // Find the sales order linked to this pick task
    const orderResult = await client.query(
      `SELECT id, external_id, source_document_id FROM sales_orders
       WHERE released_task_id = $1`,
      [pickTaskId]
    );

    if (orderResult.rowCount > 0) {
      const salesOrder = orderResult.rows[0];
      // Create pending shipment (ON CONFLICT is a safety net for reruns)
      await client.query(
        `INSERT INTO shipments (sales_order_id, pack_task_id, status)
         VALUES ($1, $2, 'pending'::shipment_status)
         ON CONFLICT (sales_order_id) DO UPDATE SET pack_task_id = EXCLUDED.pack_task_id`,
        [salesOrder.id, packTaskId]
      );
    }

    await client.query("COMMIT");
    inTransaction = false;

    // Broadcast new pack task to managers
    try {
      await publishRealtimeEvent({
        type: REALTIME_EVENT_TYPES.TASK_UPDATED,
        payload: {
          taskId: packTaskId,
          status: "created",
          taskType: "pack",
          sourceDocumentId: pickTask.source_document_id
        }
      });
    } catch (err) {
      console.error("[realtime] Failed to publish pack task created event", err);
    }
  } catch (error) {
    if (inTransaction) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    console.error("[shipment] onPickTaskCompleted failed:", error);
  } finally {
    client.release();
  }
};

/**
 * Called when a pack task completes. Updates the shipment with box/weight
 * details and fires the shipment.ready_for_label integration event.
 */
const completePackTaskShipment = async (packTaskId, { boxType, weightGrams, lengthCm, widthCm, heightCm } = {}) => {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const shipmentResult = await client.query(
      `SELECT s.*, so.external_id AS order_external_id, so.source_document_id
       FROM shipments s
       JOIN sales_orders so ON so.id = s.sales_order_id
       WHERE s.pack_task_id = $1
       FOR UPDATE OF s`,
      [packTaskId]
    );

    if (shipmentResult.rowCount === 0) {
      // No shipment linked — create one now (fallback for manual pack tasks)
      await client.query("ROLLBACK");
      return null;
    }

    const shipment = shipmentResult.rows[0];

    const safeWeight = weightGrams ? Math.round(Number(weightGrams)) : null;
    const safeLength = lengthCm ? Math.round(Number(lengthCm)) : null;
    const safeWidth = widthCm ? Math.round(Number(widthCm)) : null;
    const safeHeight = heightCm ? Math.round(Number(heightCm)) : null;

    const updateResult = await client.query(
      `UPDATE shipments
       SET box_type = $2,
           weight_grams = $3,
           length_cm = $4,
           width_cm = $5,
           height_cm = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [shipment.id, boxType || null, safeWeight, safeLength, safeWidth, safeHeight]
    );
    const updatedShipment = updateResult.rows[0];

    await client.query("COMMIT");
    inTransaction = false;

    // Fire outbound integration event for carrier label generation
    try {
      await enqueueIntegrationEvent(INTEGRATION_EVENTS.SHIPMENT_READY_FOR_LABEL, {
        shipmentId: updatedShipment.id,
        salesOrderId: updatedShipment.sales_order_id,
        orderExternalId: shipment.order_external_id,
        sourceDocumentId: shipment.source_document_id,
        boxType: updatedShipment.box_type,
        weightGrams: updatedShipment.weight_grams,
        lengthCm: updatedShipment.length_cm,
        widthCm: updatedShipment.width_cm,
        heightCm: updatedShipment.height_cm
      });
    } catch (err) {
      console.error("[integration] Failed to enqueue shipment.ready_for_label", err);
    }

    try {
      await publishRealtimeEvent({
        type: REALTIME_EVENT_TYPES.SHIPMENT_UPDATED,
        payload: { shipmentId: updatedShipment.id, status: updatedShipment.status }
      });
    } catch (err) {
      console.error("[realtime] Failed to publish SHIPMENT_UPDATED", err);
    }

    return updatedShipment;
  } catch (error) {
    if (inTransaction) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Handles an inbound shipment.labeled webhook — stores carrier, tracking
 * number, and label URL, then advances the shipment to 'labeled'.
 */
const applyShipmentLabel = async (shipmentId, { carrier, trackingNumber, labelUrl } = {}) => {
  const { rows } = await query(
    `UPDATE shipments
     SET carrier = $2,
         tracking_number = $3,
         label_url = $4,
         status = 'labeled'::shipment_status,
         updated_at = NOW()
     WHERE id = $1
       AND status IN ('pending', 'labeled')
     RETURNING *`,
    [shipmentId, carrier || null, trackingNumber || null, labelUrl || null]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Shipment not found or already dispatched");
  }

  try {
    await publishRealtimeEvent({
      type: REALTIME_EVENT_TYPES.SHIPMENT_UPDATED,
      payload: {
        shipmentId: rows[0].id,
        status: rows[0].status,
        trackingNumber: rows[0].tracking_number,
        carrier: rows[0].carrier
      }
    });
  } catch (err) {
    console.error("[realtime] Failed to publish SHIPMENT_UPDATED after label", err);
  }

  return rows[0];
};

/**
 * EOD dispatch: mark one or more labeled/pending shipments as dispatched
 * and fire outbound integration events.
 */
const dispatchShipments = async (shipmentIds) => {
  if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
    throw createHttpError(400, "shipmentIds must be a non-empty array");
  }

  const { rows } = await query(
    `UPDATE shipments
     SET status = 'dispatched'::shipment_status,
         dispatched_at = NOW(),
         updated_at = NOW()
     WHERE id = ANY($1::uuid[])
       AND status IN ('pending', 'labeled')
     RETURNING *`,
    [shipmentIds]
  );

  for (const shipment of rows) {
    try {
      await enqueueIntegrationEvent(INTEGRATION_EVENTS.SHIPMENT_DISPATCHED, {
        shipmentId: shipment.id,
        salesOrderId: shipment.sales_order_id,
        carrier: shipment.carrier,
        trackingNumber: shipment.tracking_number,
        dispatchedAt: shipment.dispatched_at
      });
    } catch (err) {
      console.error("[integration] Failed to enqueue shipment.dispatched for", shipment.id, err);
    }

    try {
      await publishRealtimeEvent({
        type: REALTIME_EVENT_TYPES.SHIPMENT_UPDATED,
        payload: { shipmentId: shipment.id, status: shipment.status }
      });
    } catch (err) {
      console.error("[realtime] Failed to publish SHIPMENT_UPDATED after dispatch", err);
    }
  }

  return rows;
};

/**
 * List shipments with optional status/date filters and pagination.
 */
const getShipments = async ({ status, date, page = 1, limit = 50 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`s.status = $${values.length}::shipment_status`);
  }
  if (date) {
    values.push(date);
    conditions.push(`s.created_at::date = $${values.length}::date`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM shipments s ${where}`,
    values
  );
  const total = countResult.rows[0]?.total ?? 0;

  const { rows } = await query(
    `SELECT
       s.*,
       so.external_id AS order_external_id,
       so.source_document_id,
       so.ship_date,
       so.priority AS order_priority
     FROM shipments s
     JOIN sales_orders so ON so.id = s.sales_order_id
     ${where}
     ORDER BY so.priority DESC, s.created_at ASC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, safeLimit, offset]
  );

  return {
    items: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit)
    }
  };
};

/**
 * EOD manifest: all pending/labeled shipments for a given date with
 * order line details for the dispatch sheet.
 */
const getManifest = async (date) => {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const { rows } = await query(
    `SELECT
       s.*,
       so.external_id AS order_external_id,
       so.source_document_id,
       so.ship_date,
       so.priority AS order_priority,
       (
         SELECT json_agg(json_build_object(
           'sku', sk.sku,
           'description', sk.description,
           'quantity', sol.quantity
         ) ORDER BY sk.sku)
         FROM sales_order_lines sol
         JOIN skus sk ON sk.id = sol.sku_id
         WHERE sol.sales_order_id = so.id
       ) AS lines
     FROM shipments s
     JOIN sales_orders so ON so.id = s.sales_order_id
     WHERE s.created_at::date = $1::date
       AND s.status IN ('pending', 'labeled')
     ORDER BY so.priority DESC, s.created_at ASC`,
    [targetDate]
  );

  return rows;
};

module.exports = {
  onPickTaskCompleted,
  completePackTaskShipment,
  applyShipmentLabel,
  dispatchShipments,
  getShipments,
  getManifest
};
