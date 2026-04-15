const { pool } = require("../db");
const { Task } = require("../models/taskModel");
const {
  ORDER_EVENT_TYPES,
  buildPurchaseOrderPutawayTaskSpecs,
  normalizeTaskGenerationEvent
} = require("./taskGenerationLogic");
const { createSalesOrder } = require("./salesOrderService");
const { resolvePutawayLocations } = require("./putawayResolutionService");

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parsePositiveIntegerEnv = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const getTaskGenerationConfig = () => ({
  pickBaseTimeSeconds: parsePositiveIntegerEnv(process.env.TASK_PICK_BASE_TIME_SECONDS, 90),
  pickTimePerUnitSeconds: parsePositiveIntegerEnv(process.env.TASK_PICK_TIME_PER_UNIT_SECONDS, 12),
  putawayBaseTimeSeconds: parsePositiveIntegerEnv(process.env.TASK_PUTAWAY_BASE_TIME_SECONDS, 75),
  putawayTimePerUnitSeconds: parsePositiveIntegerEnv(process.env.TASK_PUTAWAY_TIME_PER_UNIT_SECONDS, 10),
  putawayPriority: parsePositiveIntegerEnv(process.env.TASK_PUTAWAY_PRIORITY, 60)
});


const createTaskWithLines = async (client, taskSpec) => {
  const taskInsertResult = await client.query(
    `INSERT INTO tasks (
      type,
      priority,
      status,
      zone_id,
      source_document_id,
      estimated_time_seconds
    )
    VALUES ($1::task_type, $2, 'created'::task_status, $3, $4, $5)
    RETURNING
      id,
      type,
      priority,
      status,
      zone_id,
      assigned_operator_id,
      source_document_id,
      estimated_time_seconds,
      actual_time_seconds,
      version,
      started_at,
      completed_at,
      created_at,
      updated_at`,
    [taskSpec.type, taskSpec.priority, taskSpec.zoneId, taskSpec.sourceDocumentId, taskSpec.estimatedTimeSeconds]
  );

  const taskRow = taskInsertResult.rows[0];

  for (const line of taskSpec.lines) {
    await client.query(
      `INSERT INTO task_lines (
        task_id,
        sku_id,
        from_location_id,
        to_location_id,
        quantity,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6::task_line_status)`,
      [taskRow.id, line.skuId, line.fromLocationId, line.toLocationId, line.quantity, line.status]
    );
  }

  return Task.fromRow(taskRow);
};

const generateTasksForOrderEvent = async (eventPayload) => {
  const normalizedEvent = normalizeTaskGenerationEvent(eventPayload);

  // Sales orders go through salesOrderService which handles
  // inventory resolution, shortage detection, and task creation.
  if (normalizedEvent.type === ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK) {
    const result = await createSalesOrder(normalizedEvent);
    return {
      eventKey: normalizedEvent.eventKey,
      skipped: result.skipped,
      reason: result.reason,
      salesOrderId: result.salesOrderId,
      salesOrderStatus: result.status,
      tasks: result.releasedTaskId ? [{ id: result.releasedTaskId }] : []
    };
  }

  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const eventInsertResult = await client.query(
      `INSERT INTO task_generation_events (
        event_key,
        event_type,
        source_document_id,
        payload
      )
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id`,
      [
        normalizedEvent.eventKey,
        normalizedEvent.type,
        normalizedEvent.sourceDocumentId,
        JSON.stringify(normalizedEvent)
      ]
    );

    if (eventInsertResult.rowCount === 0) {
      await client.query("COMMIT");
      inTransaction = false;
      return {
        eventKey: normalizedEvent.eventKey,
        skipped: true,
        reason: "duplicate_event",
        tasks: []
      };
    }

    // Persist purchase order record (idempotent on source_document_id)
    const poInsertResult = await client.query(
      `INSERT INTO purchase_orders (external_id, source_document_id, status, strategy, received_at)
       VALUES ($1, $2, 'received'::purchase_order_status, $3, $4)
       ON CONFLICT (source_document_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [
        normalizedEvent.purchaseOrderId,
        normalizedEvent.sourceDocumentId,
        normalizedEvent.strategy,
        normalizedEvent.receivedAt || null
      ]
    );
    const purchaseOrderId = poInsertResult.rows[0].id;

    // Insert purchase order lines
    for (const line of normalizedEvent.lines) {
      await client.query(
        `INSERT INTO purchase_order_lines (purchase_order_id, sku_id, quantity)
         VALUES ($1, $2, $3)`,
        [purchaseOrderId, line.skuId, line.quantity]
      );
    }

    // Resolve putaway destination locations using WMS strategy
    const resolution = await resolvePutawayLocations(
      client, normalizedEvent.lines, normalizedEvent.strategy
    );

    if (!resolution.allResolved) {
      // No putaway locations available — hold the PO until capacity is freed.
      // The order is persisted as pending_capacity; reevaluatePendingPurchaseOrders()
      // will retry automatically after any OUTBOUND or TRANSFER movement.
      await client.query(
        `UPDATE purchase_orders SET status = 'pending_capacity'::purchase_order_status WHERE id = $1`,
        [purchaseOrderId]
      );
      await client.query("COMMIT");
      inTransaction = false;
      return {
        eventKey: normalizedEvent.eventKey,
        skipped: false,
        purchaseOrderId,
        pendingCapacity: true,
        tasks: []
      };
    }

    // Update lines with resolved destination locations
    for (const resolvedLine of resolution.lines) {
      await client.query(
        `UPDATE purchase_order_lines
         SET destination_location_id = $2, status = 'putaway'::purchase_order_line_status
         WHERE purchase_order_id = $1 AND sku_id = $3`,
        [purchaseOrderId, resolvedLine.destinationLocationId, resolvedLine.skuId]
      );
    }

    // Mark purchase order as in_progress
    await client.query(
      `UPDATE purchase_orders SET status = 'in_progress'::purchase_order_status WHERE id = $1`,
      [purchaseOrderId]
    );

    const config = getTaskGenerationConfig();
    const taskSpecs = buildPurchaseOrderPutawayTaskSpecs(normalizedEvent, resolution.lines, {
      baseTimeSeconds: config.putawayBaseTimeSeconds,
      timePerUnitSeconds: config.putawayTimePerUnitSeconds,
      priority: config.putawayPriority
    });

    const createdTasks = [];
    for (const taskSpec of taskSpecs) {
      const createdTask = await createTaskWithLines(client, taskSpec);
      createdTasks.push(createdTask);
    }

    await client.query("COMMIT");
    inTransaction = false;
    return {
      eventKey: normalizedEvent.eventKey,
      skipped: false,
      purchaseOrderId,
      tasks: createdTasks
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
 * Re-evaluate all purchase orders held as pending_capacity.
 * Called automatically after any OUTBOUND or TRANSFER movement frees up location space.
 *
 * Returns { evaluated, released, stillPending }.
 */
const reevaluatePendingPurchaseOrders = async () => {
  const { query } = require("../db");

  const pendingOrders = await query(
    `SELECT id, source_document_id, strategy
     FROM purchase_orders
     WHERE status = 'pending_capacity'::purchase_order_status
     ORDER BY created_at ASC`
  );

  const stats = { evaluated: 0, released: 0, stillPending: 0 };

  for (const order of pendingOrders.rows) {
    stats.evaluated += 1;
    const client = await pool.connect();
    let inTransaction = false;

    try {
      await client.query("BEGIN");
      inTransaction = true;

      // Skip if another process already picked it up
      const lockResult = await client.query(
        `SELECT id FROM purchase_orders
         WHERE id = $1 AND status = 'pending_capacity' FOR UPDATE SKIP LOCKED`,
        [order.id]
      );
      if (lockResult.rowCount === 0) {
        await client.query("COMMIT");
        continue;
      }

      const { rows: lines } = await client.query(
        `SELECT sku_id AS "skuId", quantity
         FROM purchase_order_lines
         WHERE purchase_order_id = $1 AND status = 'pending'::purchase_order_line_status`,
        [order.id]
      );

      if (lines.length === 0) {
        await client.query("COMMIT");
        continue;
      }

      const resolution = await resolvePutawayLocations(client, lines, order.strategy);

      if (resolution.allResolved) {
        for (const resolvedLine of resolution.lines) {
          await client.query(
            `UPDATE purchase_order_lines
             SET destination_location_id = $2, status = 'putaway'::purchase_order_line_status
             WHERE purchase_order_id = $1
               AND sku_id = $3
               AND status = 'pending'::purchase_order_line_status`,
            [order.id, resolvedLine.destinationLocationId, resolvedLine.skuId]
          );
        }

        const config = getTaskGenerationConfig();
        const taskSpecs = buildPurchaseOrderPutawayTaskSpecs(
          { sourceDocumentId: order.source_document_id },
          resolution.lines,
          {
            baseTimeSeconds: config.putawayBaseTimeSeconds,
            timePerUnitSeconds: config.putawayTimePerUnitSeconds,
            priority: config.putawayPriority
          }
        );

        for (const taskSpec of taskSpecs) {
          await createTaskWithLines(client, taskSpec);
        }

        await client.query(
          `UPDATE purchase_orders SET status = 'in_progress'::purchase_order_status WHERE id = $1`,
          [order.id]
        );

        stats.released += 1;
        await client.query("COMMIT");
        inTransaction = false;
      } else {
        stats.stillPending += 1;
        await client.query("COMMIT");
        inTransaction = false;
      }
    } catch (error) {
      if (inTransaction) {
        await client.query("ROLLBACK");
      }
      console.error(`[purchaseOrder] Failed to re-evaluate PO ${order.id}`, error);
    } finally {
      client.release();
    }
  }

  return stats;
};

module.exports = {
  generateTasksForOrderEvent,
  reevaluatePendingPurchaseOrders
};
