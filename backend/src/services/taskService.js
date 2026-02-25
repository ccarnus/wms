const { pool, query } = require("../db");
const { Task, TASK_STATUSES } = require("../models/taskModel");
const { publishRealtimeEvent } = require("../realtime/eventBus");
const { REALTIME_EVENT_TYPES } = require("../realtime/eventTypes");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_STATUS_SET = new Set(TASK_STATUSES);

const STATE_TRANSITIONS = Object.freeze({
  created: new Set(["assigned"]),
  assigned: new Set(["in_progress"]),
  in_progress: new Set(["completed", "paused"]),
  paused: new Set(["in_progress"]),
  completed: new Set(),
  cancelled: new Set(),
  failed: new Set()
});

const TASK_SELECT_SQL = `SELECT
  t.id,
  t.type,
  t.priority,
  t.status,
  t.zone_id,
  t.assigned_operator_id,
  t.source_document_id,
  t.estimated_time_seconds,
  t.actual_time_seconds,
  t.version,
  t.started_at,
  t.completed_at,
  t.created_at,
  t.updated_at
FROM tasks t`;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);

const assertUuid = (value, fieldName) => {
  if (!isUuid(value)) {
    throw createHttpError(400, `${fieldName} must be a valid UUID`);
  }
};

const assertTaskStatus = (value) => {
  if (!TASK_STATUS_SET.has(value)) {
    throw createHttpError(400, `Invalid task status '${value}'`);
  }
};

const parseExpectedVersion = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, "version must be a positive integer");
  }
  return parsed;
};

const parsePaginationParams = (page, limit) => {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  const safePage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit
  };
};

const buildTaskFilters = ({ status = null, operatorId = null, zoneId = null } = {}) => {
  const values = [];
  const conditions = [];

  if (status !== null && status !== undefined) {
    assertTaskStatus(status);
    values.push(status);
    conditions.push(`t.status = $${values.length}::task_status`);
  }

  if (operatorId !== null && operatorId !== undefined) {
    assertUuid(operatorId, "operatorId");
    values.push(operatorId);
    conditions.push(`t.assigned_operator_id = $${values.length}`);
  }

  if (zoneId !== null && zoneId !== undefined) {
    assertUuid(zoneId, "zoneId");
    values.push(zoneId);
    conditions.push(`t.zone_id = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { values, whereClause };
};

const isValidTaskTransition = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) {
    return false;
  }
  if (nextStatus === "cancelled") {
    return true;
  }
  const allowedNextStatuses = STATE_TRANSITIONS[currentStatus];
  return allowedNextStatuses ? allowedNextStatuses.has(nextStatus) : false;
};

const getTaskById = async (taskId) => {
  assertUuid(taskId, "taskId");
  const { rows } = await query(`${TASK_SELECT_SQL} WHERE t.id = $1`, [taskId]);
  if (rows.length === 0) {
    return null;
  }

  const task = Task.fromRow(rows[0]);

  const [zoneResult, lineResult] = await Promise.all([
    query(
      `SELECT
        z.id,
        z.name,
        z.type,
        z.warehouse_id AS "warehouseId"
      FROM zones z
      WHERE z.id = $1`,
      [task.zoneId]
    ),
    query(
      `SELECT
        tl.id,
        tl.sku_id AS "skuId",
        p.sku,
        p.name AS "skuName",
        tl.from_location_id AS "fromLocationId",
        from_loc.code AS "fromLocationCode",
        tl.to_location_id AS "toLocationId",
        to_loc.code AS "toLocationCode",
        tl.quantity,
        tl.status
      FROM task_lines tl
      INNER JOIN products p ON p.id = tl.sku_id
      LEFT JOIN locations from_loc ON from_loc.id = tl.from_location_id
      LEFT JOIN locations to_loc ON to_loc.id = tl.to_location_id
      WHERE tl.task_id = $1
      ORDER BY tl.id ASC`,
      [task.id]
    )
  ]);

  task.zone = zoneResult.rows[0] || null;
  task.lines = lineResult.rows;
  task.totalQuantity = lineResult.rows.reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  return task;
};

const listTasksPaginated = async ({
  status = null,
  operatorId = null,
  zoneId = null,
  page = 1,
  limit = 50
} = {}) => {
  const { values: filterValues, whereClause } = buildTaskFilters({ status, operatorId, zoneId });
  const pagination = parsePaginationParams(page, limit);

  const countQuery = `SELECT COUNT(*)::int AS total
FROM tasks t
${whereClause}`;
  const countResult = await query(countQuery, filterValues);
  const total = countResult.rows[0]?.total ?? 0;

  const taskValues = [...filterValues, pagination.limit, pagination.offset];
  const sql = `${TASK_SELECT_SQL}
${whereClause}
ORDER BY t.priority DESC, t.created_at ASC
LIMIT $${taskValues.length - 1}
OFFSET $${taskValues.length}`;
  const { rows } = await query(sql, taskValues);

  return {
    items: rows.map((row) => Task.fromRow(row)),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};

const listTasks = async (options = {}) => {
  const result = await listTasksPaginated(options);
  return result.items;
};

const updateTaskStatus = async (taskId, newStatus, options = {}) => {
  assertUuid(taskId, "taskId");
  assertTaskStatus(newStatus);

  const expectedVersion = parseExpectedVersion(options.expectedVersion);
  const changedByOperatorId = options.changedByOperatorId ?? null;
  if (changedByOperatorId !== null) {
    assertUuid(changedByOperatorId, "changedByOperatorId");
  }

  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    if (changedByOperatorId) {
      const operatorCheck = await client.query("SELECT id FROM operators WHERE id = $1", [changedByOperatorId]);
      if (operatorCheck.rowCount === 0) {
        throw createHttpError(400, "Unknown changedByOperatorId");
      }
    }

    const currentTaskResult = await client.query(`${TASK_SELECT_SQL} WHERE t.id = $1 FOR UPDATE`, [taskId]);
    if (currentTaskResult.rowCount === 0) {
      throw createHttpError(404, "Task not found");
    }

    const currentTask = Task.fromRow(currentTaskResult.rows[0]);

    if (expectedVersion !== null && expectedVersion !== currentTask.version) {
      throw createHttpError(
        409,
        `Task version mismatch. Expected ${expectedVersion}, current version is ${currentTask.version}`
      );
    }

    if (!isValidTaskTransition(currentTask.status, newStatus)) {
      throw createHttpError(409, `Invalid task status transition from '${currentTask.status}' to '${newStatus}'`);
    }

    const updateResult = await client.query(
      `UPDATE tasks
       SET status = $2::task_status,
           started_at = CASE
             WHEN $2::task_status = 'in_progress'::task_status AND started_at IS NULL THEN NOW()
             ELSE started_at
           END,
           completed_at = CASE
             WHEN $2::task_status = 'completed'::task_status THEN NOW()
             ELSE completed_at
           END,
           actual_time_seconds = CASE
             WHEN $2::task_status = 'completed'::task_status AND started_at IS NOT NULL THEN
               GREATEST(EXTRACT(EPOCH FROM (NOW() - started_at))::INT, 0)
             ELSE actual_time_seconds
           END,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1
         AND version = $3
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
      [taskId, newStatus, currentTask.version]
    );

    if (updateResult.rowCount === 0) {
      throw createHttpError(409, "Task was modified concurrently. Retry with the latest version");
    }

    const updatedTask = Task.fromRow(updateResult.rows[0]);

    await client.query(
      `INSERT INTO task_status_audit_logs (
        task_id,
        from_status,
        to_status,
        task_version,
        changed_by_operator_id
      )
      VALUES ($1, $2::task_status, $3::task_status, $4, $5)`,
      [taskId, currentTask.status, newStatus, updatedTask.version, changedByOperatorId]
    );

    await client.query("COMMIT");
    inTransaction = false;

    const taskUpdatedPayload = {
      taskId: updatedTask.id,
      status: updatedTask.status,
      previousStatus: currentTask.status,
      operatorId: updatedTask.assignedOperatorId,
      zoneId: updatedTask.zoneId,
      version: updatedTask.version,
      updatedAt: updatedTask.updatedAt
    };

    try {
      await publishRealtimeEvent({
        type: REALTIME_EVENT_TYPES.TASK_UPDATED,
        payload: taskUpdatedPayload
      });

      if (updatedTask.status === "assigned" && updatedTask.assignedOperatorId) {
        await publishRealtimeEvent({
          type: REALTIME_EVENT_TYPES.TASK_ASSIGNED,
          payload: {
            taskId: updatedTask.id,
            operatorId: updatedTask.assignedOperatorId,
            zoneId: updatedTask.zoneId,
            priority: updatedTask.priority,
            status: updatedTask.status,
            version: updatedTask.version,
            assignedAt: updatedTask.updatedAt
          }
        });
      }
    } catch (error) {
      console.error("[realtime] Failed to publish task status event", error);
    }

    return updatedTask;
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
  TASK_STATUS_SET,
  getTaskById,
  isValidTaskTransition,
  listTasks,
  listTasksPaginated,
  updateTaskStatus
};
