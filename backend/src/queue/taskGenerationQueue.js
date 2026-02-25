const { Queue } = require("bullmq");

const TASK_GENERATION_QUEUE_NAME = process.env.REDIS_QUEUE_TASK_GENERATION || "task-generation";

const getRedisConnectionOptions = () => ({
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

let taskGenerationQueueInstance = null;

const getTaskGenerationQueue = () => {
  if (!taskGenerationQueueInstance) {
    taskGenerationQueueInstance = new Queue(TASK_GENERATION_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000
        },
        removeOnComplete: 1000,
        removeOnFail: 1000
      }
    });
  }

  return taskGenerationQueueInstance;
};

const enqueueOrderEventJob = async (normalizedEvent) => {
  const queue = getTaskGenerationQueue();
  const job = await queue.add(normalizedEvent.type, normalizedEvent, {
    jobId: normalizedEvent.eventKey
  });

  return {
    queueName: TASK_GENERATION_QUEUE_NAME,
    jobId: job.id,
    eventKey: normalizedEvent.eventKey
  };
};

const closeTaskGenerationQueue = async () => {
  if (taskGenerationQueueInstance) {
    await taskGenerationQueueInstance.close();
    taskGenerationQueueInstance = null;
  }
};

module.exports = {
  TASK_GENERATION_QUEUE_NAME,
  closeTaskGenerationQueue,
  enqueueOrderEventJob,
  getRedisConnectionOptions
};
