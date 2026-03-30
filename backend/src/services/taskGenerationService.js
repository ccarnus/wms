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

    // Resolve putaway destination locations using WMS strategy
    const resolution = await resolvePutawayLocations(
      client, normalizedEvent.lines, normalizedEvent.strategy
    );

    if (!resolution.allResolved) {
      const failedLines = resolution.lines
        .filter((l) => l.status === "no_capacity")
        .map((l) => `SKU ${l.skuId} (qty ${l.quantity})`)
        .join(", ");
      throw createHttpError(400, `No available putaway location for: ${failedLines}`);
    }

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

module.exports = {
  generateTasksForOrderEvent
};
