const { pool, query } = require("../db");
const { resolvePickLocationsForOrder } = require("./inventoryResolutionService");
const { publishRealtimeEvent } = require("../realtime/eventBus");
const { REALTIME_EVENT_TYPES } = require("../realtime/eventTypes");
const { enqueueIntegrationEvent } = require("../queue/integrationQueue");

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Create a new sales order, attempt inventory resolution, and either
 * release it (create pick task) or hold it as pending_inventory.
 */
const createSalesOrder = async (normalizedEvent) => {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    // Dedup check via event_key
    const existingOrder = await client.query(
      "SELECT id, status FROM sales_orders WHERE event_key = $1",
      [normalizedEvent.eventKey]
    );
    if (existingOrder.rowCount > 0) {
      await client.query("COMMIT");
      inTransaction = false;
      return {
        skipped: true,
        reason: "duplicate_event",
        salesOrderId: existingOrder.rows[0].id,
        status: existingOrder.rows[0].status
      };
    }

    // Insert sales order
    const orderResult = await client.query(
      `INSERT INTO sales_orders (
        external_id, source_document_id, status, ship_date, priority, event_key
      ) VALUES ($1, $2, 'pending_inventory'::sales_order_status, $3, $4, $5)
      RETURNING id, external_id, source_document_id, status, ship_date, priority, created_at`,
      [
        normalizedEvent.salesOrderId,
        normalizedEvent.sourceDocumentId,
        normalizedEvent.shipDate,
        normalizedEvent.priority,
        normalizedEvent.eventKey
      ]
    );
    const salesOrder = orderResult.rows[0];

    // Insert order lines
    const insertedLines = [];
    for (const line of normalizedEvent.lines) {
      const lineResult = await client.query(
        `INSERT INTO sales_order_lines (sales_order_id, sku_id, quantity, status)
         VALUES ($1, $2, $3, 'pending'::sales_order_line_status)
         RETURNING id, sku_id, quantity, status`,
        [salesOrder.id, line.skuId, line.quantity]
      );
      insertedLines.push(lineResult.rows[0]);
    }

    // Attempt inventory resolution
    const resolution = await resolvePickLocationsForOrder(client, insertedLines);

    // Update each line with resolution result
    for (const resolvedLine of resolution.lines) {
      await client.query(
        `UPDATE sales_order_lines
         SET pick_location_id = $2,
             available_quantity = $3,
             status = $4::sales_order_line_status
         WHERE id = $1`,
        [
          resolvedLine.salesOrderLineId,
          resolvedLine.pickLocationId,
          resolvedLine.availableQuantity,
          resolvedLine.status
        ]
      );
    }

    let releasedTaskId = null;

    if (resolution.allResolved) {
      // All lines fulfilled — mark as ready, then release (create pick task)
      await client.query(
        "UPDATE sales_orders SET status = 'ready'::sales_order_status WHERE id = $1",
        [salesOrder.id]
      );
      salesOrder.status = "ready";

      // Create the pick task
      releasedTaskId = await releaseOrderAsTask(client, salesOrder, resolution.lines);

      await client.query(
        "UPDATE sales_orders SET status = 'released'::sales_order_status, released_task_id = $2 WHERE id = $1",
        [salesOrder.id, releasedTaskId]
      );
      salesOrder.status = "released";
    } else {
      // Some lines short — create alerts
      const shortLines = resolution.lines.filter((l) => l.status === "short");
      for (const shortLine of shortLines) {
        await client.query(
          `INSERT INTO inventory_alerts (
            sales_order_id, sales_order_line_id, sku_id,
            required_quantity, available_quantity, status
          ) VALUES ($1, $2, $3, $4, $5, 'active'::inventory_alert_status)`,
          [
            salesOrder.id,
            shortLine.salesOrderLineId,
            shortLine.skuId,
            shortLine.quantity,
            shortLine.availableQuantity
          ]
        );
      }
    }

    await client.query("COMMIT");
    inTransaction = false;

    // Publish realtime events (outside transaction)
    try {
      await publishRealtimeEvent({
        type: REALTIME_EVENT_TYPES.SALES_ORDER_UPDATED,
        payload: {
          salesOrderId: salesOrder.id,
          externalId: salesOrder.external_id,
          sourceDocumentId: salesOrder.source_document_id,
          status: salesOrder.status,
          releasedTaskId
        }
      });

      if (!resolution.allResolved) {
        const shortLines = resolution.lines.filter((l) => l.status === "short");
        await publishRealtimeEvent({
          type: REALTIME_EVENT_TYPES.INVENTORY_ALERT,
          payload: {
            salesOrderId: salesOrder.id,
            sourceDocumentId: salesOrder.source_document_id,
            shortLines: shortLines.map((l) => ({
              skuId: l.skuId,
              required: l.quantity,
              available: l.availableQuantity,
              shortage: l.quantity - l.availableQuantity
            }))
          }
        });

        // Notify master software via integration queue
        await enqueueIntegrationEvent("SALES_ORDER_SHORT", {
          salesOrderId: salesOrder.id,
          externalId: salesOrder.external_id,
          sourceDocumentId: salesOrder.source_document_id,
          shortLines: shortLines.map((l) => ({
            skuId: l.skuId,
            required: l.quantity,
            available: l.availableQuantity,
            shortage: l.quantity - l.availableQuantity
          }))
        });
      }
    } catch (error) {
      console.error("[salesOrder] Failed to publish realtime/integration events", error);
    }

    return {
      skipped: false,
      salesOrderId: salesOrder.id,
      status: salesOrder.status,
      releasedTaskId,
      lines: resolution.lines
    };
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Create a pick task from a fully resolved sales order.
 * Returns the created task ID.
 */
const releaseOrderAsTask = async (client, salesOrder, resolvedLines) => {
  const { calculateEstimatedTimeSeconds } = require("./taskGenerationLogic");

  const totalUnits = resolvedLines.reduce((sum, l) => sum + l.quantity, 0);
  const baseTimeSeconds = Number(process.env.TASK_PICK_BASE_TIME_SECONDS) || 90;
  const timePerUnitSeconds = Number(process.env.TASK_PICK_TIME_PER_UNIT_SECONDS) || 12;
  const estimatedTimeSeconds = calculateEstimatedTimeSeconds(totalUnits, baseTimeSeconds, timePerUnitSeconds);

  const taskResult = await client.query(
    `INSERT INTO tasks (
      type, priority, status, zone_id, source_document_id, estimated_time_seconds
    ) VALUES ('pick'::task_type, $1, 'created'::task_status, NULL, $2, $3)
    RETURNING id`,
    [salesOrder.priority, salesOrder.source_document_id, estimatedTimeSeconds]
  );
  const taskId = taskResult.rows[0].id;

  for (const line of resolvedLines) {
    await client.query(
      `INSERT INTO task_lines (task_id, sku_id, from_location_id, to_location_id, quantity, status)
       VALUES ($1, $2, $3, NULL, $4, 'created'::task_line_status)`,
      [taskId, line.skuId, line.pickLocationId, line.quantity]
    );
  }

  // Also insert dedup record in task_generation_events
  await client.query(
    `INSERT INTO task_generation_events (event_key, event_type, source_document_id, payload)
     VALUES ($1, 'sales_order_ready_for_pick', $2, $3::jsonb)
     ON CONFLICT (event_key) DO NOTHING`,
    [salesOrder.event_key, salesOrder.source_document_id, JSON.stringify({ salesOrderId: salesOrder.id })]
  );

  return taskId;
};

/**
 * Re-evaluate all pending_inventory sales orders. Called when inventory
 * changes (e.g., after an INBOUND or TRANSFER movement).
 *
 * Returns { evaluated, released, stillPending }.
 */
const reevaluatePendingOrders = async () => {
  const pendingOrders = await query(
    `SELECT id, external_id, source_document_id, ship_date, priority, event_key
     FROM sales_orders
     WHERE status = 'pending_inventory'::sales_order_status
     ORDER BY priority DESC, created_at ASC`
  );

  const stats = { evaluated: 0, released: 0, stillPending: 0 };

  for (const order of pendingOrders.rows) {
    stats.evaluated += 1;
    const client = await pool.connect();
    let inTransaction = false;

    try {
      await client.query("BEGIN");
      inTransaction = true;

      // Lock the order
      const lockResult = await client.query(
        "SELECT id FROM sales_orders WHERE id = $1 AND status = 'pending_inventory' FOR UPDATE SKIP LOCKED",
        [order.id]
      );
      if (lockResult.rowCount === 0) {
        await client.query("COMMIT");
        continue;
      }

      // Get current lines
      const { rows: lines } = await client.query(
        "SELECT id, sku_id, quantity FROM sales_order_lines WHERE sales_order_id = $1",
        [order.id]
      );

      // Re-attempt resolution
      const resolution = await resolvePickLocationsForOrder(client, lines);

      // Update lines
      for (const resolvedLine of resolution.lines) {
        await client.query(
          `UPDATE sales_order_lines
           SET pick_location_id = $2,
               available_quantity = $3,
               status = $4::sales_order_line_status
           WHERE id = $1`,
          [
            resolvedLine.salesOrderLineId,
            resolvedLine.pickLocationId,
            resolvedLine.availableQuantity,
            resolvedLine.status
          ]
        );
      }

      if (resolution.allResolved) {
        // Resolve all active alerts for this order
        await client.query(
          `UPDATE inventory_alerts
           SET status = 'resolved'::inventory_alert_status, resolved_at = NOW()
           WHERE sales_order_id = $1 AND status = 'active'`,
          [order.id]
        );

        // Release the order
        await client.query(
          "UPDATE sales_orders SET status = 'ready'::sales_order_status WHERE id = $1",
          [order.id]
        );

        const taskId = await releaseOrderAsTask(client, order, resolution.lines);

        await client.query(
          "UPDATE sales_orders SET status = 'released'::sales_order_status, released_task_id = $2 WHERE id = $1",
          [order.id, taskId]
        );

        stats.released += 1;

        await client.query("COMMIT");
        inTransaction = false;

        try {
          await publishRealtimeEvent({
            type: REALTIME_EVENT_TYPES.SALES_ORDER_UPDATED,
            payload: {
              salesOrderId: order.id,
              externalId: order.external_id,
              sourceDocumentId: order.source_document_id,
              status: "released",
              releasedTaskId: taskId
            }
          });
        } catch (error) {
          console.error("[salesOrder] Failed to publish release event", error);
        }
      } else {
        // Update alert quantities for short lines
        const shortLines = resolution.lines.filter((l) => l.status === "short");
        for (const shortLine of shortLines) {
          await client.query(
            `UPDATE inventory_alerts
             SET available_quantity = $2
             WHERE sales_order_line_id = $1 AND status = 'active'`,
            [shortLine.salesOrderLineId, shortLine.availableQuantity]
          );
        }

        stats.stillPending += 1;
        await client.query("COMMIT");
        inTransaction = false;
      }
    } catch (error) {
      if (inTransaction) {
        await client.query("ROLLBACK");
      }
      console.error(`[salesOrder] Failed to re-evaluate order ${order.id}`, error);
    } finally {
      client.release();
    }
  }

  return stats;
};

/**
 * List sales orders with optional status filter and pagination.
 */
const listSalesOrders = async ({ status = null, page = 1, limit = 50 } = {}) => {
  const values = [];
  const conditions = [];

  if (status) {
    values.push(status);
    conditions.push(`so.status = $${values.length}::sales_order_status`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM sales_orders so ${whereClause}`,
    values
  );
  const total = countResult.rows[0]?.total ?? 0;

  const listValues = [...values, safeLimit, offset];
  const { rows } = await query(
    `SELECT
      so.id,
      so.external_id AS "externalId",
      so.source_document_id AS "sourceDocumentId",
      so.status,
      so.ship_date AS "shipDate",
      so.priority,
      so.released_task_id AS "releasedTaskId",
      so.created_at AS "createdAt",
      so.updated_at AS "updatedAt",
      (SELECT COUNT(*)::int FROM sales_order_lines sol WHERE sol.sales_order_id = so.id) AS "lineCount",
      (SELECT COUNT(*)::int FROM sales_order_lines sol WHERE sol.sales_order_id = so.id AND sol.status = 'short') AS "shortLineCount"
    FROM sales_orders so
    ${whereClause}
    ORDER BY so.priority DESC, so.created_at ASC
    LIMIT $${listValues.length - 1}
    OFFSET $${listValues.length}`,
    listValues
  );

  return {
    items: rows,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) }
  };
};

/**
 * Get a single sales order by ID with its lines and active alerts.
 */
const getSalesOrderById = async (salesOrderId) => {
  if (!UUID_REGEX.test(salesOrderId)) {
    throw createHttpError(400, "salesOrderId must be a valid UUID");
  }

  const { rows } = await query(
    `SELECT
      so.id,
      so.external_id AS "externalId",
      so.source_document_id AS "sourceDocumentId",
      so.status,
      so.ship_date AS "shipDate",
      so.priority,
      so.released_task_id AS "releasedTaskId",
      so.created_at AS "createdAt",
      so.updated_at AS "updatedAt"
    FROM sales_orders so
    WHERE so.id = $1`,
    [salesOrderId]
  );

  if (rows.length === 0) {
    return null;
  }

  const order = rows[0];

  const [lineResult, alertResult] = await Promise.all([
    query(
      `SELECT
        sol.id,
        sol.sku_id AS "skuId",
        s.sku,
        s.description AS "skuDescription",
        sol.quantity,
        sol.pick_location_id AS "pickLocationId",
        l.code AS "pickLocationCode",
        sol.available_quantity AS "availableQuantity",
        sol.status
      FROM sales_order_lines sol
      INNER JOIN skus s ON s.id = sol.sku_id
      LEFT JOIN locations l ON l.id = sol.pick_location_id
      WHERE sol.sales_order_id = $1
      ORDER BY sol.created_at ASC`,
      [order.id]
    ),
    query(
      `SELECT
        ia.id,
        ia.sku_id AS "skuId",
        s.sku,
        ia.required_quantity AS "requiredQuantity",
        ia.available_quantity AS "availableQuantity",
        ia.shortage,
        ia.status,
        ia.created_at AS "createdAt"
      FROM inventory_alerts ia
      INNER JOIN skus s ON s.id = ia.sku_id
      WHERE ia.sales_order_id = $1
      ORDER BY ia.created_at ASC`,
      [order.id]
    )
  ]);

  order.lines = lineResult.rows;
  order.alerts = alertResult.rows;

  return order;
};

/**
 * List active inventory alerts for HMI display.
 */
const listActiveAlerts = async ({ page = 1, limit = 50 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const countResult = await query(
    "SELECT COUNT(*)::int AS total FROM inventory_alerts WHERE status = 'active'"
  );
  const total = countResult.rows[0]?.total ?? 0;

  const { rows } = await query(
    `SELECT
      ia.id,
      ia.sales_order_id AS "salesOrderId",
      so.external_id AS "orderExternalId",
      so.source_document_id AS "sourceDocumentId",
      so.ship_date AS "shipDate",
      ia.sku_id AS "skuId",
      s.sku,
      s.description AS "skuDescription",
      ia.required_quantity AS "requiredQuantity",
      ia.available_quantity AS "availableQuantity",
      ia.shortage,
      ia.status,
      ia.created_at AS "createdAt"
    FROM inventory_alerts ia
    INNER JOIN sales_orders so ON so.id = ia.sales_order_id
    INNER JOIN skus s ON s.id = ia.sku_id
    WHERE ia.status = 'active'
    ORDER BY so.priority DESC, ia.created_at ASC
    LIMIT $1 OFFSET $2`,
    [safeLimit, offset]
  );

  return {
    items: rows,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) }
  };
};

/**
 * Cancel a sales order. Only allowed when status is 'pending_inventory' or 'ready'.
 * Resolves any active inventory alerts for the order.
 */
const cancelSalesOrder = async (salesOrderId) => {
  if (!UUID_REGEX.test(salesOrderId)) {
    throw createHttpError(400, "salesOrderId must be a valid UUID");
  }

  const existing = await query(
    "SELECT id, status FROM sales_orders WHERE id = $1",
    [salesOrderId]
  );

  if (existing.rowCount === 0) {
    throw createHttpError(404, "Sales order not found");
  }

  const { status } = existing.rows[0];
  const cancellableStatuses = ["pending_inventory", "ready"];
  if (!cancellableStatuses.includes(status)) {
    throw createHttpError(
      409,
      `Cannot cancel a sales order with status '${status}'. Only '${cancellableStatuses.join("' or '")}' orders can be cancelled.`
    );
  }

  // Resolve any active alerts
  await query(
    `UPDATE inventory_alerts
     SET status = 'resolved'::inventory_alert_status, resolved_at = NOW()
     WHERE sales_order_id = $1 AND status = 'active'`,
    [salesOrderId]
  );

  const { rows } = await query(
    `UPDATE sales_orders
     SET status = 'cancelled'::sales_order_status
     WHERE id = $1
     RETURNING id, status`,
    [salesOrderId]
  );

  try {
    await publishRealtimeEvent({
      type: REALTIME_EVENT_TYPES.SALES_ORDER_UPDATED,
      payload: {
        salesOrderId,
        status: "cancelled"
      }
    });
  } catch (error) {
    console.error("[salesOrder] Failed to publish cancel event", error);
  }

  return rows[0];
};

module.exports = {
  cancelSalesOrder,
  createSalesOrder,
  getSalesOrderById,
  listActiveAlerts,
  listSalesOrders,
  reevaluatePendingOrders
};
