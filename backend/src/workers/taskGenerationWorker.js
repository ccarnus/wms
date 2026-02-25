const { Worker } = require("bullmq");
const { generateTasksForOrderEvent } = require("../services/taskGenerationService");
const { TASK_GENERATION_QUEUE_NAME, getRedisConnectionOptions } = require("../queue/taskGenerationQueue");

const concurrency = Number(process.env.TASK_GENERATION_WORKER_CONCURRENCY || 4);
const safeConcurrency = Number.isInteger(concurrency) && concurrency > 0 ? concurrency : 4;

const worker = new Worker(
  TASK_GENERATION_QUEUE_NAME,
  async (job) => generateTasksForOrderEvent(job.data),
  {
    connection: getRedisConnectionOptions(),
    concurrency: safeConcurrency
  }
);

worker.on("ready", () => {
  console.log(`Task generation worker ready (queue=${TASK_GENERATION_QUEUE_NAME}, concurrency=${safeConcurrency})`);
});

worker.on("completed", (job, result) => {
  const createdCount = Array.isArray(result?.tasks) ? result.tasks.length : 0;
  const suffix = result?.skipped ? "skipped duplicate event" : `created ${createdCount} task(s)`;
  console.log(`[task-worker] completed job ${job.id} (${suffix})`);
});

worker.on("failed", (job, error) => {
  const jobId = job?.id || "unknown";
  console.error(`[task-worker] failed job ${jobId}`, error);
});

const shutdown = async () => {
  console.log("Shutting down task generation worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
