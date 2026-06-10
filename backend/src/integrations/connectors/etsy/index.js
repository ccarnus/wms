const { query } = require("../../../db");
const { enqueueOrderEventJob } = require("../../../queue/taskGenerationQueue");
const { INTEGRATION_EVENTS, OUTBOUND_EVENTS, INBOUND_EVENTS } = require("../../integrationEvents");
const {
  buildTrackingPayload,
  extractReceiptIdFromExternalId,
  getApiBaseUrl,
  getPollIntervalMs,
  getTokenUrl,
  mapReceiptToSalesOrderEvent,
  validateEtsyConfig
} = require("./etsyLogic");

// Lazy require — integrationService requires ../integrations (the registry),
// which loads this connector. Requiring it at module load would resolve to a
// partially-initialized module.
const getIntegrationService = () => require("../../../services/integrationService");

// In-memory access-token cache: integrationId -> { accessToken, expiresAt }
const accessTokenCache = new Map();

const REQUEST_TIMEOUT_MS = 10000;

async function etsyFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Etsy request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Refresh-token flow. Etsy access tokens last 1 hour and every refresh
 * rotates the refresh token, so the new one is persisted back to the
 * integration config immediately.
 */
async function getAccessToken(integration) {
  const cached = accessTokenCache.get(integration.id);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.accessToken;
  }

  const config = integration.config || {};
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: String(config.keystring || ""),
    refresh_token: String(config.refreshToken || "")
  });

  const response = await etsyFetch(getTokenUrl(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Etsy token refresh failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Etsy token response missing access_token");
  }

  const expiresIn = Number(data.expires_in) || 3600;
  accessTokenCache.set(integration.id, {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  });

  if (data.refresh_token && data.refresh_token !== config.refreshToken) {
    integration.config = { ...config, refreshToken: data.refresh_token };
    await query(
      `UPDATE integrations
       SET config = jsonb_set(config, '{refreshToken}', to_jsonb($1::text))
       WHERE id = $2`,
      [data.refresh_token, integration.id]
    );
  }

  return data.access_token;
}

async function buildApiHeaders(integration) {
  const accessToken = await getAccessToken(integration);
  return {
    "x-api-key": String(integration.config?.keystring || ""),
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
}

/** Map Etsy listing SKU codes to WMS SKU ids in one query. */
async function resolveSkuIdsByCode(skuCodes) {
  if (skuCodes.length === 0) return new Map();
  const { rows } = await query(
    "SELECT id, sku FROM skus WHERE sku = ANY($1::text[])",
    [skuCodes]
  );
  return new Map(rows.map((row) => [row.sku, row.id]));
}

const collectSkuCodes = (receipt) =>
  [...new Set(
    (Array.isArray(receipt.transactions) ? receipt.transactions : [])
      .map((t) => String(t?.sku || "").trim())
      .filter(Boolean)
  )];

/**
 * Import a single Etsy receipt as a WMS sales order event.
 * Returns { status: "created" | "skipped" | "failed", message }.
 */
async function importReceipt(integration, receipt) {
  const receiptId = Number(receipt?.receipt_id);
  if (!Number.isInteger(receiptId) || receiptId <= 0) {
    return { status: "failed", message: "Receipt is missing a valid receipt_id" };
  }

  // Already imported (poll overlap) — skip silently, no log noise.
  const existing = await query(
    "SELECT id FROM sales_orders WHERE event_key = $1",
    [`etsy-receipt-${receiptId}`]
  );
  if (existing.rows.length > 0) {
    return { status: "skipped", message: "Receipt already imported" };
  }

  const skuIdByCode = await resolveSkuIdsByCode(collectSkuCodes(receipt));
  const { event, missingSkus } = mapReceiptToSalesOrderEvent(receipt, (code) => skuIdByCode.get(code));

  if (!event) {
    const message = missingSkus.length > 0
      ? `Unknown SKU(s) in receipt ${receiptId}: ${missingSkus.join(", ")} — create them in Configuration, then the order imports on the next poll`
      : `Receipt ${receiptId} has no order lines`;
    return { status: "failed", message };
  }

  await enqueueOrderEventJob(event);
  return { status: "created", message: `Receipt ${receiptId} enqueued as sales order ${event.salesOrderId}` };
}

const connector = {
  label: "Etsy",
  description: "Sync Etsy shop orders into the WMS and push shipment tracking back to Etsy. Etsy has no webhooks — new paid orders are pulled automatically on a schedule.",
  directions: ["inbound", "outbound", "bidirectional"],
  configSchema: [
    { key: "shopId", label: "Etsy Shop ID", type: "text", required: true, placeholder: "12345678", helpText: "Numeric shop ID — visible in your Etsy shop URL or via the getShop API" },
    { key: "keystring", label: "App API Key (keystring)", type: "text", required: true, placeholder: "1aa2bb33c44d55eeeeee6fff", helpText: "From your Etsy developer app — sent as x-api-key on every request" },
    { key: "refreshToken", label: "OAuth Refresh Token", type: "text", required: true, placeholder: "12345678.AbCdEf...", helpText: "Obtained once via Etsy's OAuth consent flow (scopes: transactions_r, transactions_w). Rotated automatically afterwards." },
    { key: "pollIntervalMinutes", label: "Order Poll Interval (minutes)", type: "number", required: false, placeholder: "5", helpText: "How often the WMS pulls new paid orders from Etsy (default 5)" },
    { key: "apiBaseUrl", label: "API Base URL Override", type: "text", required: false, placeholder: "https://openapi.etsy.com", helpText: "Leave empty for production Etsy — override only for testing against a mock" }
  ],

  validateConfig(config, direction) {
    return validateEtsyConfig(config, direction);
  },

  /**
   * Outbound dispatch. Only shipment.dispatched results in an Etsy API call
   * (creates the receipt shipment with tracking). Every other subscribed
   * event is acknowledged as skipped so subscriptions never spam failures.
   */
  async pushOutbound(integration, eventType, payload) {
    if (eventType === "integration.test") {
      const result = await connector.testConnection(integration);
      return { status: result.success ? 200 : 0, body: result.message, ok: result.success };
    }

    if (eventType !== INTEGRATION_EVENTS.SHIPMENT_DISPATCHED) {
      return { status: 0, body: `skipped: Etsy connector does not push ${eventType}`, ok: true };
    }

    try {
      const { rows } = await query(
        "SELECT external_id FROM sales_orders WHERE id = $1",
        [payload.salesOrderId]
      );
      const externalId = rows[0]?.external_id;
      const receiptId = extractReceiptIdFromExternalId(externalId);
      if (!receiptId) {
        return { status: 0, body: `skipped: sales order ${payload.salesOrderId} is not an Etsy order`, ok: true };
      }

      const trackingPayload = buildTrackingPayload(payload);
      const shopId = String(integration.config?.shopId || "").trim();
      const url = `${getApiBaseUrl(integration.config)}/v3/application/shops/${shopId}/receipts/${receiptId}/tracking`;

      const response = await etsyFetch(url, {
        method: "POST",
        headers: await buildApiHeaders(integration),
        body: JSON.stringify(trackingPayload)
      });
      const responseBody = await response.text().catch(() => "");
      return { status: response.status, body: responseBody, ok: response.ok };
    } catch (error) {
      return { status: 0, body: "", ok: false, error: error.message };
    }
  },

  /**
   * Inbound payloads pushed to POST /api/webhook/etsy. Accepts either a raw
   * Etsy receipt object or the generic { event, data } envelope.
   */
  handleInbound(payload) {
    if (payload?.receipt_id) {
      return { eventType: INTEGRATION_EVENTS.INBOUND_ORDER_CREATED, data: payload };
    }
    return { eventType: payload?.event || "unknown", data: payload?.data || payload };
  },

  /** Side effect for inbound receipts pushed via webhook: import the order. */
  async processInbound(integration, eventType, data) {
    if (eventType !== INTEGRATION_EVENTS.INBOUND_ORDER_CREATED || !data?.receipt_id) {
      return;
    }
    const result = await importReceipt(integration, data);
    if (result.status === "failed") {
      throw new Error(result.message);
    }
  },

  /**
   * Scheduled inbound poll (no webhooks on Etsy): pull paid, unshipped
   * receipts and import each as a sales order. Dedup is two-layered —
   * sales_orders.event_key here, task_generation_events in the task worker.
   */
  async pollInbound(integration) {
    const { logIntegrationEvent } = getIntegrationService();
    const shopId = String(integration.config?.shopId || "").trim();
    const url = `${getApiBaseUrl(integration.config)}/v3/application/shops/${shopId}/receipts?was_paid=true&was_shipped=false&limit=100`;

    const response = await etsyFetch(url, { headers: await buildApiHeaders(integration) });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Etsy receipts request failed: HTTP ${response.status} ${text.slice(0, 300)}`);
    }

    const data = await response.json();
    const receipts = Array.isArray(data.results) ? data.results : [];

    const summary = { pulled: receipts.length, created: 0, skipped: 0, failed: 0 };

    for (const receipt of receipts) {
      const result = await importReceipt(integration, receipt);
      summary[result.status === "created" ? "created" : result.status === "skipped" ? "skipped" : "failed"]++;

      if (result.status === "skipped") {
        continue;
      }
      await logIntegrationEvent({
        integrationId: integration.id,
        direction: "inbound",
        eventType: INTEGRATION_EVENTS.INBOUND_ORDER_CREATED,
        payload: { receiptId: receipt?.receipt_id, source: "poll" },
        status: result.status === "created" ? "success" : "failed",
        errorMessage: result.status === "failed" ? result.message : null,
        attempts: 1
      });
    }

    return summary;
  },

  getPollIntervalMs(integration) {
    return getPollIntervalMs(integration.config);
  },

  async testConnection(integration) {
    const config = integration.config || {};
    try {
      const pingResponse = await etsyFetch(`${getApiBaseUrl(config)}/v3/application/openapi-ping`, {
        headers: { "x-api-key": String(config.keystring || "") }
      });
      if (!pingResponse.ok) {
        return { success: false, message: `Etsy API key rejected: HTTP ${pingResponse.status}` };
      }

      accessTokenCache.delete(integration.id);
      await getAccessToken(integration);
      return { success: true, message: "Etsy API key valid and OAuth token refresh succeeded" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  availableOutboundEvents: OUTBOUND_EVENTS,
  availableInboundEvents: INBOUND_EVENTS
};

module.exports = connector;
