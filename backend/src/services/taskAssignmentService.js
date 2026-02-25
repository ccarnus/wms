const { pool } = require("../db");
const { Task } = require("../models/taskModel");
const { publishRealtimeEvent } = require("../realtime/eventBus");
const { REALTIME_EVENT_TYPES } = require("../realtime/eventTypes");

const ACTIVE_TASK_STATUSES = ["assigned", "in_progress", "paused"];
const DEFAULT_ASSIGNMENT_BATCH_SIZE = 200;

const parsePositiveInteger = (value, fallbackValue) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
};

const getAvailableOperatorCount = async (client) => {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM operators o
     WHERE o.status = 'available'::operator_status
       AND NOT EXISTS (
         SELECT 1
         FROM tasks t
         WHERE t.assigned_operator_id = o.id
           AND t.status = ANY($1::task_status[])
       )`,
    [ACTIVE_TASK_STATUSES]
  );

  return rows[0]?.count ?? 0;
};

const lockCandidateTasks = async (client, batchSize) => {
  const { rows } = await client.query(
    `SELECT
      t.id,
      t.zone_id,
      t.priority
     FROM tasks t
     WHERE t.status = 'created'::task_status
     ORDER BY t.priority DESC, t.created_at ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [batchSize]
  );

  return rows;
};

const findBestAvailableOperatorForZone = async (client, zoneId, dateValue) => {
  const { rows } = await client.query(
    `SELECT
      o.id,
      COALESCE(ldm.tasks_completed, 0)::int AS workload
     FROM operators o
     INNER JOIN operator_zones oz
       ON oz.operator_id = o.id
      AND oz.zone_id = $1
     LEFT JOIN labor_daily_metrics ldm
       ON ldm.operator_id = o.id
      AND ldm.date = $2::date
     WHERE o.status = 'available'::operator_status
       AND NOT EXISTS (
         SELECT 1
         FROM tasks t
         WHERE t.assigned_operator_id = o.id
           AND t.status = ANY($3::task_status[])
       )
     ORDER BY workload ASC, o.performance_score DESC, o.created_at ASC
     LIMIT 1
     FOR UPDATE OF o SKIP LOCKED`,
    [zoneId, dateValue, ACTIVE_TASK_STATUSES]
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    operatorId: rows[0].id,
    workload: rows[0].workload
  };
};

const assignTaskToOperator = async (client, taskId, operatorId) => {
  const { rows, rowCount } = await client.query(
    `UPDATE tasks
     SET status = 'assigned'::task_status,
         assigned_operator_id = $2,
         version = version + 1,
         updated_at = NOW()
     WHERE id = $1
       AND status = 'created'::task_status
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
    [taskId, operatorId]
  );

  if (rowCount === 0) {
    return null;
  }

  const task = Task.fromRow(rows[0]);

  await client.query(
    `INSERT INTO task_status_audit_logs (
      task_id,
      from_status,
      to_status,
      task_version,
      changed_by_operator_id
    )
    VALUES ($1, 'created'::task_status, 'assigned'::task_status, $2, NULL)`,
    [task.id, task.version]
  );

  return task;
};

const assignTasks = async (options = {}) => {
  const startedAt = Date.now();
  const batchSize = parsePositiveInteger(
    options.batchSize ?? process.env.TASK_ASSIGNMENT_BATCH_SIZE,
    DEFAULT_ASSIGNMENT_BATCH_SIZE
  );
  const dateValue = options.date ?? new Date().toISOString().slice(0, 10);
  const client = await pool.connect();
  let inTransaction = false;

  const stats = {
    batchSize,
    scannedTasks: 0,
    assignedTasks: 0,
    unassignedTasks: 0,
    availableOperators: 0,
    assignments: [],
    realtimePublishFailures: 0,
    durationMs: 0
  };
  const realtimeEvents = [];

  try {
    await client.query("BEGIN");
    inTransaction = true;

    stats.availableOperators = await getAvailableOperatorCount(client);

    const candidateTasks = await lockCandidateTasks(client, batchSize);
    stats.scannedTasks = candidateTasks.length;

    for (const candidateTask of candidateTasks) {
      const selectedOperator = await findBestAvailableOperatorForZone(client, candidateTask.zone_id, dateValue);
      if (!selectedOperator) {
        stats.unassignedTasks += 1;
        continue;
      }

      const assignedTask = await assignTaskToOperator(client, candidateTask.id, selectedOperator.operatorId);
      if (!assignedTask) {
        continue;
      }

      stats.assignedTasks += 1;
      const assignmentRecord = {
        taskId: assignedTask.id,
        operatorId: selectedOperator.operatorId,
        zoneId: assignedTask.zoneId,
        priority: assignedTask.priority,
        workload: selectedOperator.workload
      };
      stats.assignments.push(assignmentRecord);

      realtimeEvents.push({
        type: REALTIME_EVENT_TYPES.TASK_ASSIGNED,
        payload: {
          taskId: assignedTask.id,
          operatorId: selectedOperator.operatorId,
          zoneId: assignedTask.zoneId,
          priority: assignedTask.priority,
          status: assignedTask.status,
          version: assignedTask.version,
          assignedAt: assignedTask.updatedAt
        }
      });
      realtimeEvents.push({
        type: REALTIME_EVENT_TYPES.TASK_UPDATED,
        payload: {
          taskId: assignedTask.id,
          status: assignedTask.status,
          previousStatus: "created",
          operatorId: selectedOperator.operatorId,
          zoneId: assignedTask.zoneId,
          version: assignedTask.version,
          updatedAt: assignedTask.updatedAt
        }
      });
    }

    await client.query("COMMIT");
    inTransaction = false;
    stats.durationMs = Date.now() - startedAt;

    for (const event of realtimeEvents) {
      try {
        await publishRealtimeEvent(event);
      } catch (error) {
        stats.realtimePublishFailures += 1;
        console.error("[realtime] Failed to publish assignment event", error);
      }
    }

    return stats;
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
  ACTIVE_TASK_STATUSES,
  assignTasks
};
