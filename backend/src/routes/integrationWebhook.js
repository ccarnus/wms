const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getIntegrationByConnectorType, logIntegrationEvent } = require("../services/integrationService");
const { getConnector } = require("../integrations");
const { applyShipmentLabel } = require("../services/shipmentService");
const { INTEGRATION_EVENTS } = require("../integrations/integrationEvents");

const router = express.Router();

// OAuth 2.0 signing secret per integration (derived from inbound client secret)
function getOAuthSigningSecret(integration) {
  const config = integration.config || {};
  return config.inboundOauth2ClientSecret || "";
}

// OAuth 2.0 Client Credentials token endpoint for inbound integrations
router.post("/oauth/token", express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const grantType = req.body.grant_type;
    if (grantType !== "client_credentials") {
      return res.status(400).json({ error: "unsupported_grant_type", error_description: "Only client_credentials is supported" });
    }

    // Accept client credentials from Basic header or body
    let clientId, clientSecret;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Basic ")) {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
      const colonIdx = decoded.indexOf(":");
      if (colonIdx === -1) {
        return res.status(401).json({ error: "invalid_client", error_description: "Invalid Basic auth format" });
      }
      clientId = decodeURIComponent(decoded.slice(0, colonIdx));
      clientSecret = decodeURIComponent(decoded.slice(colonIdx + 1));
    } else {
      clientId = req.body.client_id;
      clientSecret = req.body.client_secret;
    }

    if (!clientId || !clientSecret) {
      return res.status(401).json({ error: "invalid_client", error_description: "Missing client credentials" });
    }

    // Find integration by connector type encoded in client_id (format: "connectorType:clientId")
    const parts = clientId.split(":");
    const connectorType = parts[0];
    const expectedClientId = parts.slice(1).join(":") || clientId;

    const integration = await getIntegrationByConnectorType(connectorType);
    if (!integration) {
      return res.status(401).json({ error: "invalid_client", error_description: "Unknown client" });
    }

    const config = integration.config || {};
    if (config.inboundAuthType !== "oauth2") {
      return res.status(401).json({ error: "invalid_client", error_description: "OAuth 2.0 not enabled for this integration" });
    }

    if (expectedClientId !== config.inboundOauth2ClientId || clientSecret !== config.inboundOauth2ClientSecret) {
      return res.status(401).json({ error: "invalid_client", error_description: "Invalid client credentials" });
    }

    // Issue a short-lived JWT as the access token
    const signingSecret = getOAuthSigningSecret(integration);
    const expiresIn = 3600;
    const accessToken = jwt.sign(
      { sub: clientId, integrationId: integration.id, type: "oauth2_access" },
      signingSecret,
      { algorithm: "HS256", expiresIn }
    );

    res.json({ access_token: accessToken, token_type: "Bearer", expires_in: expiresIn });
  } catch (error) {
    next(error);
  }
});

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

  // "oauth2" — verify Bearer token issued by the WMS token endpoint
  if (inboundAuth === "oauth2") {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return "Missing or invalid Authorization header — expected Bearer <token>";
    }
    const token = authHeader.slice(7);
    const signingSecret = config.inboundOauth2ClientSecret;
    if (!signingSecret) return "Integration misconfigured — no OAuth 2.0 client secret set";

    try {
      const decoded = jwt.verify(token, signingSecret, { algorithms: ["HS256"] });
      if (decoded.type !== "oauth2_access") return "Invalid token type";
      return null;
    } catch (err) {
      if (err.name === "TokenExpiredError") return "Access token has expired";
      if (err.name === "JsonWebTokenError") return "Invalid access token: " + err.message;
      return "Token verification failed";
    }
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

    // Dispatch inbound events that require WMS side-effects
    if (eventType === INTEGRATION_EVENTS.INBOUND_SHIPMENT_LABELED) {
      try {
        const shipmentId = data?.shipmentId;
        if (!shipmentId) throw new Error("shipmentId is required in inbound.shipment.labeled payload");
        await applyShipmentLabel(shipmentId, {
          carrier: data.carrier,
          trackingNumber: data.trackingNumber,
          labelUrl: data.labelUrl
        });
      } catch (err) {
        await logIntegrationEvent({
          integrationId: integration.id,
          direction: "inbound",
          eventType,
          payload: data,
          status: "failed",
          errorMessage: err.message,
          attempts: 1
        });
        return res.status(422).json({ error: err.message });
      }
    }

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
