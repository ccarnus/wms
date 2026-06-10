// Pure Etsy mapping/validation logic — no DB or network access, unit-testable.

const ETSY_API_BASE_URL = "https://openapi.etsy.com";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_EXTERNAL_ID_PREFIX = "ETSY-";
const DEFAULT_POLL_INTERVAL_MINUTES = 5;
const DEFAULT_SHIP_LEAD_DAYS = 3;

const validateEtsyConfig = (config, direction) => {
  const errors = [];
  const cfg = config || {};

  const shopId = String(cfg.shopId || "").trim();
  if (!shopId) {
    errors.push("shopId is required");
  } else if (!/^\d+$/.test(shopId)) {
    errors.push("shopId must be a numeric Etsy shop ID");
  }

  if (!String(cfg.keystring || "").trim()) {
    errors.push("keystring (Etsy app API key) is required");
  }

  if (!String(cfg.refreshToken || "").trim()) {
    errors.push("refreshToken is required — obtain it via Etsy's OAuth 2.0 authorization code flow");
  }

  if (cfg.pollIntervalMinutes !== undefined && cfg.pollIntervalMinutes !== null && String(cfg.pollIntervalMinutes) !== "") {
    const interval = Number(cfg.pollIntervalMinutes);
    if (!Number.isFinite(interval) || interval < 1) {
      errors.push("pollIntervalMinutes must be a number greater than or equal to 1");
    }
  }

  if (cfg.apiBaseUrl) {
    try {
      const parsed = new URL(String(cfg.apiBaseUrl));
      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.push("apiBaseUrl must use http or https");
      }
    } catch (_err) {
      errors.push("apiBaseUrl is not a valid URL");
    }
  }

  // Direction has no bearing on required fields: both pulling receipts (inbound)
  // and pushing tracking (outbound) need the same OAuth credentials.
  void direction;

  return errors;
};

const getApiBaseUrl = (config) =>
  String((config || {}).apiBaseUrl || ETSY_API_BASE_URL).replace(/\/+$/, "");

const getTokenUrl = (config) => String((config || {}).tokenUrl || ETSY_TOKEN_URL);

const getPollIntervalMs = (config) => {
  const minutes = Number((config || {}).pollIntervalMinutes);
  const safeMinutes = Number.isFinite(minutes) && minutes >= 1 ? minutes : DEFAULT_POLL_INTERVAL_MINUTES;
  return safeMinutes * 60 * 1000;
};

/** Etsy timestamps are epoch seconds. Returns an ISO string or null. */
const parseEtsyTimestamp = (value) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
};

const buildReceiptEventKey = (receiptId) => `etsy-receipt-${receiptId}`;

const buildExternalOrderId = (receiptId) => `${ETSY_EXTERNAL_ID_PREFIX}${receiptId}`;

/** Reverse of buildExternalOrderId — returns the numeric receipt ID or null. */
const extractReceiptIdFromExternalId = (externalId) => {
  const match = /^ETSY-(\d+)$/.exec(String(externalId || "").trim());
  return match ? Number(match[1]) : null;
};

/**
 * Map an Etsy receipt (GET /shops/{shop_id}/receipts result item) to the
 * sales-order event payload accepted by normalizeTaskGenerationEvent.
 *
 * `resolveSkuId(skuCode)` maps an Etsy listing SKU string to a WMS SKU id
 * (returns null/undefined when unknown). The caller provides it so this
 * module stays DB-free.
 *
 * Returns { event, missingSkus }:
 *  - event is null when the receipt has no mappable lines
 *  - missingSkus lists SKU codes (or "transaction <id>" markers) that could
 *    not be mapped — the receipt must not be imported while any are missing,
 *    otherwise the order would be silently incomplete.
 */
const mapReceiptToSalesOrderEvent = (receipt, resolveSkuId, { now = new Date() } = {}) => {
  const receiptId = Number(receipt?.receipt_id);
  if (!Number.isInteger(receiptId) || receiptId <= 0) {
    throw new Error("Etsy receipt is missing a valid receipt_id");
  }

  const transactions = Array.isArray(receipt.transactions) ? receipt.transactions : [];
  const quantityBySkuId = new Map();
  const missingSkus = [];

  for (const transaction of transactions) {
    const quantity = Number(transaction?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      continue;
    }

    const skuCode = String(transaction?.sku || "").trim();
    if (!skuCode) {
      missingSkus.push(`transaction ${transaction?.transaction_id || "?"} has no SKU`);
      continue;
    }

    const skuId = resolveSkuId(skuCode);
    if (!skuId) {
      missingSkus.push(skuCode);
      continue;
    }

    quantityBySkuId.set(skuId, (quantityBySkuId.get(skuId) || 0) + quantity);
  }

  if (missingSkus.length > 0 || quantityBySkuId.size === 0) {
    return { event: null, missingSkus };
  }

  const shipDate =
    parseEtsyTimestamp(receipt.expected_ship_date) ||
    new Date(now.getTime() + DEFAULT_SHIP_LEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  return {
    event: {
      type: "sales_order_ready_for_pick",
      salesOrderId: buildExternalOrderId(receiptId),
      eventKey: buildReceiptEventKey(receiptId),
      shipDate,
      lines: [...quantityBySkuId.entries()].map(([skuId, quantity]) => ({ skuId, quantity }))
    },
    missingSkus: []
  };
};

/**
 * Build the body for POST /shops/{shop_id}/receipts/{receipt_id}/tracking.
 * Throws when the shipment has no tracking number — Etsy requires one.
 */
const buildTrackingPayload = ({ trackingNumber, carrier }) => {
  const trackingCode = String(trackingNumber || "").trim();
  if (!trackingCode) {
    throw new Error("trackingNumber is required to mark an Etsy receipt as shipped");
  }
  return {
    tracking_code: trackingCode,
    carrier_name: String(carrier || "other").trim() || "other",
    send_bcc: false
  };
};

module.exports = {
  DEFAULT_POLL_INTERVAL_MINUTES,
  ETSY_API_BASE_URL,
  ETSY_TOKEN_URL,
  buildExternalOrderId,
  buildReceiptEventKey,
  buildTrackingPayload,
  extractReceiptIdFromExternalId,
  getApiBaseUrl,
  getPollIntervalMs,
  getTokenUrl,
  mapReceiptToSalesOrderEvent,
  parseEtsyTimestamp,
  validateEtsyConfig
};
