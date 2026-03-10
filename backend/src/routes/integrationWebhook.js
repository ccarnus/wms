const express = require("express");
const jwt = require("jsonwebtoken");
const { getIntegrationByConnectorType, logIntegrationEvent } = require("../services/integrationService");
const { getConnector } = require("../integrations");

const router = express.Router();

function verifyInboundAuth(req, integration) {
  const config = integration.config || {};
  const inboundAuth = config.inboundAuthType;

  // "none" or missing — no additional auth required (URL API key is enough for routing)
  if (!inboundAuth || inboundAuth === "none" || inboundAuth === "apikey") return null;

  // "credentials" — verify X-API-Key header matches the stored secret
  if (inboundAuth === "credentials") {
    const secret = config.inboundCredentialSecret;
    if (!secret) return "Integration misconfigured — no inbound credential secret set";
    const apiKeyHeader = req.headers["x-api-key"];
    if (!apiKeyHeader) return "Missing X-API-Key header";
    if (apiKeyHeader !== secret) return "Invalid API key";
    return null;
  }

  // "basic" — verify Authorization: Basic header
  if (inboundAuth === "basic") {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return "Missing or invalid Authorization header — expected Basic <base64>";
    }
    const encoded = authHeader.slice(6);
    let decoded;
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf8");
    } catch (_e) {
      return "Invalid Base64 encoding in Authorization header";
    }
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) return "Invalid Basic auth format — expected username:password";
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    const expectedUsername = config.inboundBasicUsername;
    const expectedPassword = config.inboundBasicPassword;
    if (!expectedUsername || !expectedPassword) return "Integration misconfigured — no inbound Basic auth credentials set";
    if (username !== expectedUsername || password !== expectedPassword) return "Invalid Basic auth credentials";
    return null;
  }

  // "jwt" (or legacy "apikey_jwt") — verify Bearer JWT
  if (inboundAuth === "jwt" || inboundAuth === "apikey_jwt") {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return "Missing or invalid Authorization header — expected Bearer <jwt>";
    }

    const token = authHeader.slice(7);
    const secret = config.inboundJwtSecret;
    if (!secret) {
      return "Integration misconfigured — no inbound JWT secret set";
    }

    try {
      const verifyOptions = { algorithms: ["HS256"] };
      if (config.inboundJwtIssuer) {
        verifyOptions.issuer = config.inboundJwtIssuer;
      }
      jwt.verify(token, secret, verifyOptions);
      return null;
    } catch (err) {
      if (err.name === "TokenExpiredError") return "JWT has expired";
      if (err.name === "JsonWebTokenError") return "Invalid JWT: " + err.message;
      return "JWT verification failed";
    }
  }

  return null;
}

// Public inbound webhook — routed by connector type, auth depends on inboundAuthType
router.post("/:connectorType", async (req, res, next) => {
  try {
    const integration = await getIntegrationByConnectorType(req.params.connectorType);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found or disabled" });
    }
    if (!["inbound", "bidirectional"].includes(integration.direction)) {
      return res.status(400).json({ error: "Integration does not accept inbound events" });
    }

    const authError = verifyInboundAuth(req, integration);
    if (authError) {
      await logIntegrationEvent({
        integrationId: integration.id,
        direction: "inbound",
        eventType: "auth.failed",
        payload: {},
        status: "failed",
        errorMessage: authError,
        attempts: 1
      });
      return res.status(401).json({ error: authError });
    }

    const connector = getConnector(integration.connectorType);
    const { eventType, data } = connector.handleInbound(req.body);

    await logIntegrationEvent({
      integrationId: integration.id,
      direction: "inbound",
      eventType,
      payload: data,
      status: "success",
      attempts: 1
    });

    res.json({ received: true, eventType });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
