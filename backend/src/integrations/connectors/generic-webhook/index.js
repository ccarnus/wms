const jwt = require("jsonwebtoken");
const { OUTBOUND_EVENTS, INBOUND_EVENTS } = require("../../integrationEvents");

// In-memory OAuth token cache: integrationId -> { accessToken, expiresAt }
const oauthTokenCache = new Map();

async function fetchOAuthToken(integration) {
  const config = integration.config || {};
  const cached = oauthTokenCache.get(integration.id);
  if (cached && cached.expiresAt > Date.now() + 30000) {
    return cached.accessToken;
  }

  const tokenUrl = config.oauth2TokenUrl;
  if (!tokenUrl) throw new Error("OAuth 2.0 token URL not configured");

  const clientId = config.oauth2ClientId || "";
  const clientSecret = integration.authHeaderValue || "";
  const scope = config.oauth2Scope || "";

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (scope) body.set("scope", scope);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64")
    },
    body: body.toString()
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error("OAuth token request failed: HTTP " + response.status + " " + text);
  }

  const data = await response.json();
  const accessToken = data.access_token;
  if (!accessToken) throw new Error("OAuth token response missing access_token");

  const expiresIn = Number(data.expires_in) || 3600;
  oauthTokenCache.set(integration.id, { accessToken, expiresAt: Date.now() + expiresIn * 1000 });

  return accessToken;
}

async function buildAuthHeaders(integration) {
  const authType = integration.config?.authType;

  if (authType === "jwt" && integration.authHeaderValue) {
    const claims = {};
    if (integration.config.jwtIssuer) claims.iss = integration.config.jwtIssuer;
    if (integration.config.jwtAudience) claims.aud = integration.config.jwtAudience;
    const token = jwt.sign(claims, integration.authHeaderValue, { algorithm: "HS256", expiresIn: "12h" });
    return { Authorization: "Bearer " + token };
  }

  if (authType === "oauth2") {
    const accessToken = await fetchOAuthToken(integration);
    return { Authorization: "Bearer " + accessToken };
  }

  if (authType === "basic" && integration.authHeaderValue) {
    const username = integration.config?.basicUsername || "";
    const password = integration.authHeaderValue;
    const encoded = Buffer.from(username + ":" + password).toString("base64");
    return { Authorization: "Basic " + encoded };
  }

  if (authType === "header" && integration.authHeaderValue) {
    return { [integration.authHeaderName || "X-Webhook-Secret"]: integration.authHeaderValue };
  }

  // Legacy: no authType in config — fall back to old behavior
  if (!authType && integration.authHeaderValue) {
    return { [integration.authHeaderName || "X-Webhook-Secret"]: integration.authHeaderValue };
  }

  return {};
}

const connector = {
  label: "Generic Webhook",
  description: "Send and receive JSON payloads via HTTP webhooks. Works with any system that supports webhooks.",
  directions: ["inbound", "outbound", "bidirectional"],
  configSchema: [
    { key: "outboundUrl", label: "Outbound Webhook URL", type: "url", required: true, placeholder: "https://example.com/webhook", helpText: "URL to POST events to" },
    { key: "timeoutMs", label: "Request Timeout (ms)", type: "number", required: false, placeholder: "5000", helpText: "Max wait time for outbound requests" }
  ],

  validateConfig(config, direction) {
    const errors = [];
    if (["outbound", "bidirectional"].includes(direction)) {
      if (!config.outboundUrl || typeof config.outboundUrl !== "string") {
        errors.push("outboundUrl is required for outbound webhooks");
      } else {
        try {
          const parsed = new URL(config.outboundUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            errors.push("outboundUrl must use http or https");
          }
        } catch (_err) {
          errors.push("outboundUrl is not a valid URL");
        }
      }
    }
    return errors;
  },

  async pushOutbound(integration, eventType, payload) {
    const url = integration.config.outboundUrl;
    const timeoutMs = Number(integration.config.timeoutMs) || 5000;

    const headers = { "Content-Type": "application/json", ...(await buildAuthHeaders(integration)) };

    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal
      });
      const responseBody = await response.text().catch(() => "");
      return { status: response.status, body: responseBody, ok: response.ok };
    } catch (error) {
      if (error.name === "AbortError") {
        return { status: 0, body: "", ok: false, error: `Request timed out after ${timeoutMs}ms` };
      }
      return { status: 0, body: "", ok: false, error: error.message };
    } finally {
      clearTimeout(timer);
    }
  },

  handleInbound(payload) {
    return { eventType: payload?.event || "unknown", data: payload?.data || payload };
  },

  async testConnection(integration) {
    if (["outbound", "bidirectional"].includes(integration.direction)) {
      const result = await connector.pushOutbound(integration, "integration.test", { test: true, timestamp: new Date().toISOString() });
      if (result.error) {
        return { success: false, message: result.error };
      }
      return { success: result.ok, message: `HTTP ${result.status}` };
    }
    return { success: true, message: "Inbound-only integration — no outbound test needed" };
  },

  availableOutboundEvents: OUTBOUND_EVENTS,
  availableInboundEvents: INBOUND_EVENTS
};

module.exports = connector;
