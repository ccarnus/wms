const { pool } = require("../db");
const { Task } = require("../models/taskModel");
const {
  ORDER_EVENT_TYPES,
  buildPurchaseOrderPutawayTaskSpecs,
  buildSalesOrderPickTaskSpecs,
  normalizeTaskGenerationEvent
} = require("./taskGenerationLogic");

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

const buildTaskSpecList = (normalizedEvent, zoneResolver, config) => {
  if (normalizedEvent.type === ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK) {
    return buildSalesOrderPickTaskSpecs(normalizedEvent, zoneResolver, {
      baseTimeSeconds: config.pickBaseTimeSeconds,
      timePerUnitSeconds: config.pickTimePerUnitSeconds
    });
  }

  if (normalizedEvent.type === ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED) {
    return buildPurchaseOrderPutawayTaskSpecs(normalizedEvent, zoneResolver, {
      baseTimeSeconds: config.putawayBaseTimeSeconds,
      timePerUnitSeconds: config.putawayTimePerUnitSeconds,
      priority: config.putawayPriority
    });
  }

  throw createHttpError(400, `Unsupported event type '${normalizedEvent.type}'`);
};

const resolveZoneByLocationMap = async (client, locationIds) => {
  const uniqueLocationIds = [...new Set(locationIds)];
  if (uniqueLocationIds.length === 0) {
    throw createHttpError(400, "At least one location is required");
  }

  const { rows } = await client.query(
    `SELECT
      lz.location_id,
      lz.zone_id
    FROM location_zones lz
    WHERE lz.location_id = ANY($1::int[])`,
    [uniqueLocationIds]
  );

  const locationZoneMap = new Map(rows.map((row) => [Number(row.location_id), row.zone_id]));
  const missingLocationIds = uniqueLocationIds.filter((locationId) => !locationZoneMap.has(locationId));

  if (missingLocationIds.length > 0) {
    throw createHttpError(400, `Missing zone mapping for location IDs: ${missingLocationIds.join(", ")}`);
  }

  return locationZoneMap;
};

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

const extractLocationIds = (normalizedEvent) => {
  if (normalizedEvent.type === ORDER_EVENT_TYPES.SALES_ORDER_READY_FOR_PICK) {
    return normalizedEvent.lines.map((line) => line.pickLocationId);
  }

  if (normalizedEvent.type === ORDER_EVENT_TYPES.PURCHASE_ORDER_RECEIVED) {
    return normalizedEvent.lines.map((line) => line.destinationLocationId);
  }

  return [];
};

const generateTasksForOrderEvent = async (eventPayload) => {
  const normalizedEvent = normalizeTaskGenerationEvent(eventPayload);
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

    const locationIds = extractLocationIds(normalizedEvent);
    const zoneByLocationId = await resolveZoneByLocationMap(client, locationIds);
    const zoneResolver = (locationId) => zoneByLocationId.get(locationId);
    const config = getTaskGenerationConfig();
    const taskSpecs = buildTaskSpecList(normalizedEvent, zoneResolver, config);

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
