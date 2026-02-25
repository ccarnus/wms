const { pool } = require("../db");
const {
  calculateShiftDurationSeconds,
  calculateUtilizationPercent,
  parseAggregationDate,
  toLocalIsoDate
} = require("./laborMetricsAggregationUtils");

const METRICS_BY_OPERATOR_SQL = `SELECT
  t.assigned_operator_id AS operator_id,
  COUNT(*)::int AS tasks_completed,
  COALESCE(
    AVG(
      COALESCE(
        t.actual_time_seconds::double precision,
        CASE
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL THEN
            GREATEST(EXTRACT(EPOCH FROM (t.completed_at - t.started_at)), 0)
          ELSE 0
        END
      )
    ),
    0
  )::double precision AS avg_task_time,
  COALESCE(
    SUM(
      COALESCE(
        t.actual_time_seconds::double precision,
        CASE
          WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL THEN
            GREATEST(EXTRACT(EPOCH FROM (t.completed_at - t.started_at)), 0)
          ELSE 0
        END
      )
    ),
    0
  )::double precision AS total_active_time_seconds,
  COALESCE(SUM(line_totals.units_processed), 0)::int AS units_processed
FROM tasks t
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(tl.quantity), 0)::int AS units_processed
  FROM task_lines tl
  WHERE tl.task_id = t.id
) line_totals ON true
WHERE t.status = 'completed'::task_status
  AND t.assigned_operator_id IS NOT NULL
  AND t.completed_at >= $1::date
  AND t.completed_at < ($1::date + INTERVAL '1 day')
GROUP BY t.assigned_operator_id`;

const UPSERT_SQL_PREFIX = `INSERT INTO labor_daily_metrics (
  operator_id,
  date,
  tasks_completed,
  units_processed,
  avg_task_time,
  utilization_percent
)
VALUES `;

const UPSERT_SQL_SUFFIX = `
ON CONFLICT (operator_id, date) DO UPDATE
SET
  tasks_completed = EXCLUDED.tasks_completed,
  units_processed = EXCLUDED.units_processed,
  avg_task_time = EXCLUDED.avg_task_time,
  utilization_percent = EXCLUDED.utilization_percent
RETURNING
  tasks_completed,
  units_processed,
  avg_task_time,
  utilization_percent,
  (xmax = 0) AS inserted`;

const normalizeMetricsRow = (row) => ({
  tasksCompleted: Number(row.tasks_completed || 0),
  unitsProcessed: Number(row.units_processed || 0),
  avgTaskTime: Number(row.avg_task_time || 0),
  totalActiveTimeSeconds: Number(row.total_active_time_seconds || 0)
});

const buildUpsertRows = (operatorRows, metricsByOperator, effectiveDate) =>
  operatorRows.map((operator) => {
    const metricValues =
      metricsByOperator.get(operator.id) || {
        tasksCompleted: 0,
        unitsProcessed: 0,
        avgTaskTime: 0,
        totalActiveTimeSeconds: 0
      };

    const shiftDurationSeconds = calculateShiftDurationSeconds(operator.shift_start, operator.shift_end);
    const utilizationPercent = calculateUtilizationPercent(
      metricValues.totalActiveTimeSeconds,
      shiftDurationSeconds
    );

    return {
      operatorId: operator.id,
      date: effectiveDate,
      tasksCompleted: metricValues.tasksCompleted,
      unitsProcessed: metricValues.unitsProcessed,
      avgTaskTime: metricValues.avgTaskTime,
      utilizationPercent
    };
  });

const buildUpsertQuery = (rows) => {
  const values = [];
  const placeholders = [];

  for (const row of rows) {
    const startIndex = values.length + 1;
    values.push(
      row.operatorId,
      row.date,
      row.tasksCompleted,
      row.unitsProcessed,
      row.avgTaskTime,
      row.utilizationPercent
    );
    placeholders.push(
      `($${startIndex}, $${startIndex + 1}::date, $${startIndex + 2}, $${startIndex + 3}, $${startIndex + 4}, $${startIndex + 5})`
    );
  }

  return {
    sql: `${UPSERT_SQL_PREFIX}${placeholders.join(", ")}${UPSERT_SQL_SUFFIX}`,
    values
  };
};

const aggregateLaborDailyMetrics = async ({ date } = {}) => {
  const effectiveDate = parseAggregationDate(date);
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const operatorResult = await client.query(
      `SELECT
        o.id,
        o.shift_start::text AS shift_start,
        o.shift_end::text AS shift_end
      FROM operators o
      ORDER BY o.id ASC`
    );

    if (operatorResult.rowCount === 0) {
      await client.query("COMMIT");
      inTransaction = false;
      return {
        date: effectiveDate,
        operatorsProcessed: 0,
        insertedCount: 0,
        updatedCount: 0,
        totalTasksCompleted: 0,
        totalUnitsProcessed: 0,
        averageTaskTimeSeconds: 0,
        averageUtilizationPercent: 0
      };
    }

    const metricsResult = await client.query(METRICS_BY_OPERATOR_SQL, [effectiveDate]);
    const metricsByOperator = new Map();
    for (const row of metricsResult.rows) {
      metricsByOperator.set(row.operator_id, normalizeMetricsRow(row));
    }

    const upsertRows = buildUpsertRows(operatorResult.rows, metricsByOperator, effectiveDate);
    const upsertQuery = buildUpsertQuery(upsertRows);
    const upsertResult = await client.query(upsertQuery.sql, upsertQuery.values);

    await client.query("COMMIT");
    inTransaction = false;

    const totals = upsertResult.rows.reduce(
      (acc, row) => {
        const tasksCompleted = Number(row.tasks_completed || 0);
        const unitsProcessed = Number(row.units_processed || 0);
        const avgTaskTime = Number(row.avg_task_time || 0);
        const utilizationPercent = Number(row.utilization_percent || 0);

        acc.totalTasksCompleted += tasksCompleted;
        acc.totalUnitsProcessed += unitsProcessed;
        acc.totalAvgTaskTime += avgTaskTime;
        acc.totalUtilizationPercent += utilizationPercent;
        if (row.inserted) {
          acc.insertedCount += 1;
        } else {
          acc.updatedCount += 1;
        }
        return acc;
      },
      {
        insertedCount: 0,
        updatedCount: 0,
        totalTasksCompleted: 0,
        totalUnitsProcessed: 0,
        totalAvgTaskTime: 0,
        totalUtilizationPercent: 0
      }
    );

    const operatorsProcessed = upsertResult.rowCount;
    return {
      date: effectiveDate,
      operatorsProcessed,
      insertedCount: totals.insertedCount,
      updatedCount: totals.updatedCount,
      totalTasksCompleted: totals.totalTasksCompleted,
      totalUnitsProcessed: totals.totalUnitsProcessed,
      averageTaskTimeSeconds:
        operatorsProcessed > 0 ? Number((totals.totalAvgTaskTime / operatorsProcessed).toFixed(2)) : 0,
      averageUtilizationPercent:
        operatorsProcessed > 0
          ? Number((totals.totalUtilizationPercent / operatorsProcessed).toFixed(2))
          : 0
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
  aggregateLaborDailyMetrics,
  calculateShiftDurationSeconds,
  calculateUtilizationPercent,
  parseAggregationDate,
  toLocalIsoDate
};
