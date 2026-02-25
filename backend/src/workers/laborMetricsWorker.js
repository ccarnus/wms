const { pool } = require("../db");
const {
  aggregateLaborDailyMetrics,
  toLocalIsoDate
} = require("../services/laborMetricsAggregationService");

const DEFAULT_RUN_HOUR = 23;
const DEFAULT_RUN_MINUTE = 59;

const parseIntegerInRange = (value, minValue, maxValue, fallbackValue) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minValue || parsed > maxValue) {
    return fallbackValue;
  }
  return parsed;
};

const parseBoolean = (value, fallbackValue = false) => {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallbackValue;
};

const runHour = parseIntegerInRange(
  process.env.LABOR_METRICS_RUN_HOUR,
  0,
  23,
  DEFAULT_RUN_HOUR
);
const runMinute = parseIntegerInRange(
  process.env.LABOR_METRICS_RUN_MINUTE,
  0,
  59,
  DEFAULT_RUN_MINUTE
);
const runOnStartup = parseBoolean(process.env.LABOR_METRICS_RUN_ON_STARTUP, false);

let timeoutHandle = null;
let isShuttingDown = false;
let runningPromise = null;

const getNextRunAt = (fromDate = new Date()) => {
  const nextRun = new Date(fromDate);
  nextRun.setHours(runHour, runMinute, 0, 0);

  if (nextRun.getTime() <= fromDate.getTime()) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
};

const scheduleNextRun = () => {
  if (isShuttingDown) {
    return;
  }

  const now = new Date();
  const nextRunAt = getNextRunAt(now);
  const delayMs = Math.max(nextRunAt.getTime() - now.getTime(), 0);

  console.log(
    `[labor-metrics-worker] next run scheduled at ${nextRunAt.toISOString()} ` +
      `(in ${Math.round(delayMs / 1000)}s)`
  );

  timeoutHandle = setTimeout(async () => {
    runningPromise = runAggregationCycle("schedule", nextRunAt);
    await runningPromise;
    runningPromise = null;
    scheduleNextRun();
  }, delayMs);
};

const runAggregationCycle = async (trigger, runDate = new Date()) => {
  const effectiveDate = toLocalIsoDate(runDate);
  const startedAt = Date.now();

  try {
    const stats = await aggregateLaborDailyMetrics({ date: effectiveDate });
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[labor-metrics-worker] trigger=${trigger} date=${stats.date} ` +
        `operators=${stats.operatorsProcessed} inserted=${stats.insertedCount} updated=${stats.updatedCount} ` +
        `tasksCompleted=${stats.totalTasksCompleted} unitsProcessed=${stats.totalUnitsProcessed} ` +
        `avgTaskTime=${stats.averageTaskTimeSeconds}s avgUtilization=${stats.averageUtilizationPercent}% ` +
        `durationMs=${elapsedMs}`
    );
  } catch (error) {
    console.error(`[labor-metrics-worker] aggregation failed (trigger=${trigger}, date=${effectiveDate})`, error);
  }
};

const start = async () => {
  console.log(
    `[labor-metrics-worker] started (daily schedule=${String(runHour).padStart(2, "0")}:${String(runMinute).padStart(
      2,
      "0"
    )}, runOnStartup=${runOnStartup})`
  );

  if (runOnStartup) {
    runningPromise = runAggregationCycle("startup", new Date());
    await runningPromise;
    runningPromise = null;
  }

  scheduleNextRun();
};

const shutdown = async () => {
  isShuttingDown = true;

  try {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (runningPromise) {
      await runningPromise;
      runningPromise = null;
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("[labor-metrics-worker] shutdown failed", error);
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
