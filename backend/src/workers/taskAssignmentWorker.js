const { pool } = require("../db");
const { assignTasks } = require("../services/taskAssignmentService");

const DEFAULT_ASSIGNMENT_INTERVAL_MS = 10000;
const DEFAULT_ASSIGNMENT_BATCH_SIZE = 200;

const parsePositiveInteger = (value, fallbackValue) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
};

const assignmentIntervalMs = parsePositiveInteger(
  process.env.TASK_ASSIGNMENT_INTERVAL_MS,
  DEFAULT_ASSIGNMENT_INTERVAL_MS
);
const assignmentBatchSize = parsePositiveInteger(
  process.env.TASK_ASSIGNMENT_BATCH_SIZE,
  DEFAULT_ASSIGNMENT_BATCH_SIZE
);

let isRunning = false;
let intervalHandle = null;

const runAssignmentCycle = async () => {
  if (isRunning) {
    console.log("[assignment-worker] previous cycle still running, skipping tick");
    return;
  }

  isRunning = true;
  const cycleStartedAt = Date.now();

  try {
    const stats = await assignTasks({
      batchSize: assignmentBatchSize
    });
    console.log(
      `[assignment-worker] scanned=${stats.scannedTasks} assigned=${stats.assignedTasks} ` +
        `unassigned=${stats.unassignedTasks} availableOperators=${stats.availableOperators} ` +
        `durationMs=${stats.durationMs}`
    );
  } catch (error) {
    console.error("[assignment-worker] cycle failed", error);
  } finally {
    isRunning = false;
    const cycleElapsedMs = Date.now() - cycleStartedAt;
    if (cycleElapsedMs > assignmentIntervalMs) {
      console.warn(
        `[assignment-worker] cycle exceeded interval (${cycleElapsedMs}ms > ${assignmentIntervalMs}ms)`
      );
    }
  }
};

const start = () => {
  console.log(
    `[assignment-worker] started (intervalMs=${assignmentIntervalMs}, batchSize=${assignmentBatchSize})`
  );
  runAssignmentCycle();
  intervalHandle = setInterval(runAssignmentCycle, assignmentIntervalMs);
};

const shutdown = async () => {
  try {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("[assignment-worker] shutdown failed", error);
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
