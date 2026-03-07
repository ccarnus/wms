const express = require("express");
const jwt = require("jsonwebtoken");
const { getIntegrationByInboundKey, logIntegrationEvent } = require("../services/integrationService");
const { getConnector } = require("../integrations");

const router = express.Router();

function verifyInboundJwt(req, integration) {
  const config = integration.config || {};
  const inboundAuth = config.inboundAuthType;
  // Only verify JWT if explicitly set to "jwt" (or legacy "apikey_jwt")
  if (inboundAuth !== "jwt" && inboundAuth !== "apikey_jwt") return null;

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

// Public inbound webhook — authenticated via API key in the URL, optionally also JWT
router.post("/:apiKey", async (req, res, next) => {
  try {
    const integration = await getIntegrationByInboundKey(req.params.apiKey);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found or disabled" });
    }
    if (!["inbound", "bidirectional"].includes(integration.direction)) {
      return res.status(400).json({ error: "Integration does not accept inbound events" });
    }

    const jwtError = verifyInboundJwt(req, integration);
    if (jwtError) {
      await logIntegrationEvent({
        integrationId: integration.id,
        direction: "inbound",
        eventType: "auth.failed",
        payload: {},
        status: "failed",
        errorMessage: jwtError,
        attempts: 1
      });
      return res.status(401).json({ error: jwtError });
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
