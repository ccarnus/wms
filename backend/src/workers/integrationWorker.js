const { Worker } = require("bullmq");
const { INTEGRATION_QUEUE_NAME, getRedisConnectionOptions } = require("../queue/integrationQueue");

// Bootstrap connector registry
require("../integrations");

const { getEnabledIntegrationsForEvent, logIntegrationEvent } = require("../services/integrationService");
const { getConnector } = require("../integrations");

const concurrency = Number(process.env.INTEGRATION_WORKER_CONCURRENCY || 4);
const safeConcurrency = Number.isInteger(concurrency) && concurrency > 0 ? concurrency : 4;

const processIntegrationJob = async (job) => {
  const { eventType, payload } = job.data;
  const integrations = await getEnabledIntegrationsForEvent(eventType);

  if (integrations.length === 0) {
    return { eventType, dispatched: 0 };
  }

  const results = [];

  for (const integration of integrations) {
    if (!["outbound", "bidirectional"].includes(integration.direction)) continue;

    const connector = getConnector(integration.connectorType);
    const result = await connector.pushOutbound(integration, eventType, payload);

    const logEntry = {
      integrationId: integration.id,
      direction: "outbound",
      eventType,
      payload,
      responseStatus: result.status,
      responseBody: (result.body || "").slice(0, 2000),
      status: result.ok ? "success" : "failed",
      errorMessage: result.error || (result.ok ? null : "HTTP " + result.status),
      attempts: job.attemptsMade + 1
    };

    await logIntegrationEvent(logEntry);

    if (!result.ok) {
      results.push({ integrationId: integration.id, success: false });
    } else {
      results.push({ integrationId: integration.id, success: true });
    }
  }

  const failedCount = results.filter((r) => !r.success).length;
  if (failedCount > 0 && failedCount === results.length) {
    throw new Error("All integration dispatches failed for event " + eventType);
  }

  return { eventType, dispatched: results.length, failed: failedCount };
};

const worker = new Worker(INTEGRATION_QUEUE_NAME, processIntegrationJob, {
  connection: getRedisConnectionOptions(),
  concurrency: safeConcurrency
});

worker.on("ready", () => {
  console.log("[integration-worker] ready (queue=" + INTEGRATION_QUEUE_NAME + ", concurrency=" + safeConcurrency + ")");
});

worker.on("completed", (job, result) => {
  console.log("[integration-worker] completed job " + job.id + " (event=" + result.eventType + ", dispatched=" + result.dispatched + ")");
});

worker.on("failed", (job, error) => {
  const jobId = job?.id || "unknown";
  console.error("[integration-worker] failed job " + jobId, error.message);
});

const shutdown = async () => {
  console.log("Shutting down integration worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
