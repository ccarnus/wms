const { registerConnector } = require("./connectorRegistry");
const genericWebhookConnector = require("./connectors/generic-webhook");
const etsyConnector = require("./connectors/etsy");

registerConnector("generic-webhook", genericWebhookConnector);
registerConnector("etsy", etsyConnector);

module.exports = {
  ...require("./connectorRegistry"),
  ...require("./integrationEvents")
};
