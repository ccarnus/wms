const { registerConnector } = require("./connectorRegistry");
const genericWebhookConnector = require("./connectors/generic-webhook");

registerConnector("generic-webhook", genericWebhookConnector);

module.exports = {
  ...require("./connectorRegistry"),
  ...require("./integrationEvents")
};
