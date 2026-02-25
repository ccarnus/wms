const { query } = require("../db");

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

const parseIsoDate = (value, fieldName) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format`);
    error.statusCode = 400;
    throw error;
  }

  const parsedDate = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.statusCode = 400;
    throw error;
  }

  return text;
};

const parsePositiveIntegerFilter = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const getLaborOverview = async ({ date = null } = {}) => {
  const effectiveDate = parseIsoDate(date, "date");

  const { rows } = await query(
    `SELECT
      $1::date AS date,
      (SELECT COUNT(*)::int FROM operators WHERE status = 'available'::operator_status) AS "availableOperators",
      (SELECT COUNT(*)::int FROM operators WHERE status = 'busy'::operator_status) AS "busyOperators",
      (SELECT COUNT(*)::int FROM operators WHERE status = 'offline'::operator_status) AS "offlineOperators",
      (SELECT COUNT(*)::int FROM tasks WHERE status = 'created'::task_status) AS "createdTasks",
      (SELECT COUNT(*)::int FROM tasks WHERE status = 'assigned'::task_status) AS "assignedTasks",
      (SELECT COUNT(*)::int FROM tasks WHERE status = 'in_progress'::task_status) AS "inProgressTasks",
      (SELECT COUNT(*)::int FROM tasks WHERE status = 'paused'::task_status) AS "pausedTasks",
      (SELECT COUNT(*)::int FROM tasks WHERE status = 'completed'::task_status) AS "completedTasks",
      (SELECT COUNT(*)::int FROM tasks WHERE status = 'cancelled'::task_status) AS "cancelledTasks",
      (SELECT COUNT(*)::int FROM tasks WHERE status = 'failed'::task_status) AS "failedTasks",
      (SELECT COALESCE(SUM(ldm.tasks_completed), 0)::int FROM labor_daily_metrics ldm WHERE ldm.date = $1::date) AS "tasksCompleted",
      (SELECT COALESCE(SUM(ldm.units_processed), 0)::int FROM labor_daily_metrics ldm WHERE ldm.date = $1::date) AS "unitsProcessed",
      (SELECT COALESCE(AVG(ldm.avg_task_time), 0)::double precision FROM labor_daily_metrics ldm WHERE ldm.date = $1::date) AS "avgTaskTime",
      (SELECT COALESCE(AVG(ldm.utilization_percent), 0)::double precision FROM labor_daily_metrics ldm WHERE ldm.date = $1::date) AS "avgUtilizationPercent"`,
    [effectiveDate]
  );

  return rows[0];
};

const getLaborOperatorPerformance = async ({ date = null, page = 1, limit = 50 } = {}) => {
  const effectiveDate = parseIsoDate(date, "date");
  const pagination = parsePaginationParams(page, limit);

  const countResult = await query("SELECT COUNT(*)::int AS total FROM operators");
  const total = countResult.rows[0]?.total ?? 0;

  const { rows } = await query(
    `SELECT
      o.id AS "operatorId",
      o.name AS "operatorName",
      o.role,
      o.status,
      o.performance_score AS "performanceScore",
      COALESCE(ldm.tasks_completed, 0)::int AS "tasksCompleted",
      COALESCE(ldm.units_processed, 0)::int AS "unitsProcessed",
      COALESCE(ldm.avg_task_time, 0)::double precision AS "avgTaskTime",
      COALESCE(ldm.utilization_percent, 0)::double precision AS "utilizationPercent",
      COALESCE(active.active_tasks, 0)::int AS "activeTasks",
      current_task.id AS "currentTaskId",
      current_task.type AS "currentTaskType",
      current_task.status AS "currentTaskStatus"
    FROM operators o
    LEFT JOIN labor_daily_metrics ldm
      ON ldm.operator_id = o.id
     AND ldm.date = $1::date
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS active_tasks
      FROM tasks t
      WHERE t.assigned_operator_id = o.id
        AND t.status IN ('assigned'::task_status, 'in_progress'::task_status, 'paused'::task_status)
    ) active ON true
    LEFT JOIN LATERAL (
      SELECT
        t.id,
        t.type,
        t.status
      FROM tasks t
      WHERE t.assigned_operator_id = o.id
        AND t.status IN ('assigned'::task_status, 'in_progress'::task_status, 'paused'::task_status)
      ORDER BY
        CASE t.status
          WHEN 'in_progress'::task_status THEN 0
          WHEN 'paused'::task_status THEN 1
          WHEN 'assigned'::task_status THEN 2
          ELSE 3
        END,
        t.priority DESC,
        t.created_at ASC
      LIMIT 1
    ) current_task ON true
    ORDER BY "utilizationPercent" DESC, "tasksCompleted" DESC, o.performance_score DESC, o.name ASC
    LIMIT $2
    OFFSET $3`,
    [effectiveDate, pagination.limit, pagination.offset]
  );

  return {
    items: rows,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};

const getLaborZoneWorkload = async ({ warehouseId = null, page = 1, limit = 50 } = {}) => {
  const parsedWarehouseId = parsePositiveIntegerFilter(warehouseId, "warehouse_id");
  const pagination = parsePaginationParams(page, limit);

  const countValues = [];
  let whereClause = "";
  if (parsedWarehouseId !== null) {
    countValues.push(parsedWarehouseId);
    whereClause = `WHERE z.warehouse_id = $${countValues.length}`;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM zones z
     ${whereClause}`,
    countValues
  );
  const total = countResult.rows[0]?.total ?? 0;

  const listValues = [...countValues, pagination.limit, pagination.offset];
  const { rows } = await query(
    `SELECT
      z.id AS "zoneId",
      z.name AS "zoneName",
      z.type AS "zoneType",
      z.warehouse_id AS "warehouseId",
      COUNT(t.id)::int AS "totalTasks",
      COUNT(*) FILTER (WHERE t.status = 'created'::task_status)::int AS "createdTasks",
      COUNT(*) FILTER (WHERE t.status = 'assigned'::task_status)::int AS "assignedTasks",
      COUNT(*) FILTER (WHERE t.status = 'in_progress'::task_status)::int AS "inProgressTasks",
      COUNT(*) FILTER (WHERE t.status = 'paused'::task_status)::int AS "pausedTasks",
      COUNT(*) FILTER (WHERE t.status = 'completed'::task_status)::int AS "completedTasks",
      COUNT(*) FILTER (WHERE t.status = 'cancelled'::task_status)::int AS "cancelledTasks",
      COUNT(*) FILTER (WHERE t.status = 'failed'::task_status)::int AS "failedTasks",
      COALESCE(AVG(t.priority), 0)::double precision AS "avgPriority"
    FROM zones z
    LEFT JOIN tasks t ON t.zone_id = z.id
    ${whereClause}
    GROUP BY z.id
    ORDER BY "createdTasks" DESC, "inProgressTasks" DESC, z.name ASC
    LIMIT $${listValues.length - 1}
    OFFSET $${listValues.length}`,
    listValues
  );

  return {
    items: rows,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};

module.exports = {
  getLaborOperatorPerformance,
  getLaborOverview,
  getLaborZoneWorkload
};
