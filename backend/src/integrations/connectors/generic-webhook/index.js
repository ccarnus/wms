const { OUTBOUND_EVENTS, INBOUND_EVENTS } = require("../../integrationEvents");

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

    const headers = { "Content-Type": "application/json" };
    if (integration.auth_header_value) {
      headers[integration.auth_header_name || "X-Webhook-Secret"] = integration.auth_header_value;
    }

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
