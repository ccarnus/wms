const connectors = new Map();

const registerConnector = (type, connector) => {
  if (connectors.has(type)) {
    throw new Error(`Connector type '${type}' is already registered`);
  }
  connectors.set(type, connector);
};

const getConnector = (type) => {
  const connector = connectors.get(type);
  if (!connector) {
    throw new Error(`Unknown connector type '${type}'`);
  }
  return connector;
};

const listConnectorTypes = () => {
  const types = [];
  for (const [type, connector] of connectors) {
    types.push({
      type,
      label: connector.label,
      description: connector.description,
      directions: connector.directions,
      configSchema: connector.configSchema
    });
  }
  return types;
};

module.exports = { registerConnector, getConnector, listConnectorTypes };
