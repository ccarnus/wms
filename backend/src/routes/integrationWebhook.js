const express = require("express");
const { getIntegrationByInboundKey, logIntegrationEvent } = require("../services/integrationService");
const { getConnector } = require("../integrations");

const router = express.Router();

// Public inbound webhook — authenticated via API key in the URL, not JWT
router.post("/:apiKey", async (req, res, next) => {
  try {
    const integration = await getIntegrationByInboundKey(req.params.apiKey);
    if (!integration) {
      return res.status(404).json({ error: "Integration not found or disabled" });
    }
    if (!["inbound", "bidirectional"].includes(integration.direction)) {
      return res.status(400).json({ error: "Integration does not accept inbound events" });
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
