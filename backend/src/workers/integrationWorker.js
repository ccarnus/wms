const { Worker } = require("bullmq");
const { INTEGRATION_QUEUE_NAME, getRedisConnectionOptions } = require("../queue/integrationQueue");

// Bootstrap connector registry
require("../integrations");

const { getEnabledIntegrationsForEvent, listIntegrations, logIntegrationEvent } = require("../services/integrationService");
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

// ---------------------------------------------------------------------------
// Inbound polling — for connectors without webhooks (e.g. Etsy). The worker
// ticks every minute and polls each enabled inbound/bidirectional integration
// whose connector exposes pollInbound(), honoring the connector's own
// per-integration interval (getPollIntervalMs).
// ---------------------------------------------------------------------------

const POLL_TICK_MS = Number(process.env.INTEGRATION_POLL_TICK_MS || 60000);
const lastPolledAt = new Map();
let pollTickRunning = false;

const pollInboundIntegrations = async () => {
  if (pollTickRunning) return;
  pollTickRunning = true;
  try {
    const integrations = await listIntegrations();
    for (const integration of integrations) {
      if (!integration.isEnabled) continue;
      if (!["inbound", "bidirectional"].includes(integration.direction)) continue;

      let connector;
      try {
        connector = getConnector(integration.connectorType);
      } catch (_err) {
        continue;
      }
      if (typeof connector.pollInbound !== "function") continue;

      const intervalMs = typeof connector.getPollIntervalMs === "function"
        ? connector.getPollIntervalMs(integration)
        : 300000;
      const last = lastPolledAt.get(integration.id) || 0;
      if (Date.now() - last < intervalMs) continue;

      lastPolledAt.set(integration.id, Date.now());
      try {
        const result = await connector.pollInbound(integration);
        if (result && (result.created > 0 || result.failed > 0)) {
          console.log(
            "[integration-worker] polled " + integration.connectorType +
            " (" + integration.name + "): pulled=" + result.pulled +
            " created=" + result.created + " skipped=" + result.skipped +
            " failed=" + result.failed
          );
        }
      } catch (error) {
        console.error(
          "[integration-worker] inbound poll failed for " + integration.connectorType +
          " (" + integration.name + "): " + error.message
        );
        try {
          await logIntegrationEvent({
            integrationId: integration.id,
            direction: "inbound",
            eventType: "poll.failed",
            payload: {},
            status: "failed",
            errorMessage: error.message,
            attempts: 1
          });
        } catch (logError) {
          console.error("[integration-worker] failed to log poll failure", logError.message);
        }
      }
    }
  } catch (error) {
    console.error("[integration-worker] poll tick failed: " + error.message);
  } finally {
    pollTickRunning = false;
  }
};

const pollTimer = setInterval(pollInboundIntegrations, POLL_TICK_MS);
// First poll shortly after boot so new orders appear without waiting a full tick.
const initialPollTimer = setTimeout(pollInboundIntegrations, 5000);

const shutdown = async () => {
  console.log("Shutting down integration worker...");
  clearInterval(pollTimer);
  clearTimeout(initialPollTimer);
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
