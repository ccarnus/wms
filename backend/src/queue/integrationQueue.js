const { Queue } = require("bullmq");

const INTEGRATION_QUEUE_NAME = process.env.REDIS_QUEUE_INTEGRATION || "integration-outbound";

const getRedisConnectionOptions = () => ({
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

let integrationQueueInstance = null;

const getIntegrationQueue = () => {
  if (!integrationQueueInstance) {
    integrationQueueInstance = new Queue(INTEGRATION_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 500,
        removeOnFail: 500
      }
    });
  }
  return integrationQueueInstance;
};

const enqueueIntegrationEvent = async (eventType, payload) => {
  const queue = getIntegrationQueue();
  const job = await queue.add(eventType, { eventType, payload, enqueuedAt: new Date().toISOString() });
  return { queueName: INTEGRATION_QUEUE_NAME, jobId: job.id };
};

const closeIntegrationQueue = async () => {
  if (integrationQueueInstance) {
    await integrationQueueInstance.close();
    integrationQueueInstance = null;
  }
};

module.exports = {
  INTEGRATION_QUEUE_NAME,
  getRedisConnectionOptions,
  getIntegrationQueue,
  enqueueIntegrationEvent,
  closeIntegrationQueue
};
