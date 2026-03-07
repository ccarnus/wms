const { query } = require("../db");
const { getConnector, listConnectorTypes } = require("../integrations");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_DIRECTIONS = new Set(["inbound", "outbound", "bidirectional"]);

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getConnectorTypes = () => listConnectorTypes();

const listIntegrations = async () => {
  const result = await query(`
    SELECT id, name, connector_type, direction, is_enabled, config,
           subscribed_events, auth_header_name, inbound_api_key,
           created_at, updated_at
    FROM integrations
    ORDER BY created_at DESC
  `);
  return result.rows.map(formatIntegration);
};

const getIntegrationById = async (id) => {
  if (!UUID_REGEX.test(id)) throw createHttpError(400, "Invalid integration ID");
  const result = await query(`
    SELECT id, name, connector_type, direction, is_enabled, config,
           subscribed_events, auth_header_name, auth_header_value, inbound_api_key,
           created_at, updated_at
    FROM integrations WHERE id = $1
  `, [id]);
  if (result.rows.length === 0) throw createHttpError(404, "Integration not found");
  return formatIntegration(result.rows[0]);
};

const getIntegrationByInboundKey = async (apiKey) => {
  const result = await query(`
    SELECT id, name, connector_type, direction, is_enabled, config,
           subscribed_events, auth_header_name, auth_header_value, inbound_api_key,
           created_at, updated_at
    FROM integrations WHERE inbound_api_key = $1 AND is_enabled = true
  `, [apiKey]);
  if (result.rows.length === 0) return null;
  return formatIntegration(result.rows[0]);
};

const getIntegrationByConnectorType = async (connectorType) => {
  const result = await query(`
    SELECT id, name, connector_type, direction, is_enabled, config,
           subscribed_events, auth_header_name, auth_header_value, inbound_api_key,
           created_at, updated_at
    FROM integrations WHERE connector_type = $1 AND is_enabled = true
  `, [connectorType]);
  if (result.rows.length === 0) return null;
  return formatIntegration(result.rows[0]);
};

const createIntegration = async ({ name, connectorType, direction, config, subscribedEvents, authHeaderName, authHeaderValue, createdBy }) => {
  if (!name || typeof name !== "string") throw createHttpError(400, "name is required");
  if (!connectorType) throw createHttpError(400, "connectorType is required");

  const connector = getConnector(connectorType);

  // Enforce one integration per connector type
  const existing = await query("SELECT id FROM integrations WHERE connector_type = $1", [connectorType]);
  if (existing.rows.length > 0) throw createHttpError(409, "An integration already exists for connector type '" + connectorType + "'. Only one integration per connector is allowed.");

  const dir = direction || "outbound";
  if (!VALID_DIRECTIONS.has(dir)) throw createHttpError(400, "direction must be inbound, outbound, or bidirectional");
  if (!connector.directions.includes(dir)) throw createHttpError(400, "Connector does not support direction " + dir);

  const cfg = config || {};
  const configErrors = connector.validateConfig(cfg, dir);
  if (configErrors.length > 0) throw createHttpError(400, configErrors.join("; "));

  const events = Array.isArray(subscribedEvents) ? subscribedEvents : [];

  const result = await query(`
    INSERT INTO integrations (name, connector_type, direction, config, subscribed_events, auth_header_name, auth_header_value, created_by)
    VALUES ($1, $2, $3::integration_direction, $4, $5, $6, $7, $8)
    RETURNING id, name, connector_type, direction, is_enabled, config,
              subscribed_events, auth_header_name, inbound_api_key, created_at, updated_at
  `, [name, connectorType, dir, JSON.stringify(cfg), events, authHeaderName || "X-Webhook-Secret", authHeaderValue || null, createdBy || null]);

  return formatIntegration(result.rows[0]);
};

const updateIntegration = async (id, updates) => {
  if (!UUID_REGEX.test(id)) throw createHttpError(400, "Invalid integration ID");

  const existing = await getIntegrationById(id);
  const connector = getConnector(existing.connectorType);

  const name = updates.name ?? existing.name;
  const dir = updates.direction ?? existing.direction;
  const cfg = updates.config ?? existing.config;
  const events = updates.subscribedEvents ?? existing.subscribedEvents;
  const authName = updates.authHeaderName ?? existing.authHeaderName;
  const authValue = updates.authHeaderValue !== undefined ? updates.authHeaderValue : existing.authHeaderValue;
  const isEnabled = updates.isEnabled !== undefined ? updates.isEnabled : existing.isEnabled;

  if (!VALID_DIRECTIONS.has(dir)) throw createHttpError(400, "Invalid direction");
  const configErrors = connector.validateConfig(cfg, dir);
  if (configErrors.length > 0) throw createHttpError(400, configErrors.join("; "));

  const result = await query(`
    UPDATE integrations
    SET name = $1, direction = $2::integration_direction, config = $3, subscribed_events = $4,
        auth_header_name = $5, auth_header_value = $6, is_enabled = $7
    WHERE id = $8
    RETURNING id, name, connector_type, direction, is_enabled, config,
              subscribed_events, auth_header_name, inbound_api_key, created_at, updated_at
  `, [name, dir, JSON.stringify(cfg), events, authName, authValue, isEnabled, id]);

  return formatIntegration(result.rows[0]);
};

const deleteIntegration = async (id) => {
  if (!UUID_REGEX.test(id)) throw createHttpError(400, "Invalid integration ID");
  const result = await query("DELETE FROM integrations WHERE id = $1 RETURNING id", [id]);
  if (result.rows.length === 0) throw createHttpError(404, "Integration not found");
};

const toggleIntegration = async (id, isEnabled) => {
  if (!UUID_REGEX.test(id)) throw createHttpError(400, "Invalid integration ID");
  const result = await query(`
    UPDATE integrations SET is_enabled = $1 WHERE id = $2
    RETURNING id, name, connector_type, direction, is_enabled, config,
              subscribed_events, auth_header_name, inbound_api_key, created_at, updated_at
  `, [!!isEnabled, id]);
  if (result.rows.length === 0) throw createHttpError(404, "Integration not found");
  return formatIntegration(result.rows[0]);
};

const testIntegration = async (id) => {
  const integration = await getIntegrationById(id);
  const connector = getConnector(integration.connectorType);
  return connector.testConnection(integration);
};

const getEnabledIntegrationsForEvent = async (eventType) => {
  const result = await query(`
    SELECT id, name, connector_type, direction, is_enabled, config,
           subscribed_events, auth_header_name, auth_header_value, inbound_api_key,
           created_at, updated_at
    FROM integrations
    WHERE is_enabled = true AND $1 = ANY(subscribed_events)
  `, [eventType]);
  return result.rows.map(formatIntegration);
};

const logIntegrationEvent = async ({ integrationId, direction, eventType, payload, responseStatus, responseBody, status, errorMessage, attempts }) => {
  await query(`
    INSERT INTO integration_event_log (integration_id, direction, event_type, payload, response_status, response_body, status, error_message, attempts)
    VALUES ($1, $2::integration_direction, $3, $4, $5, $6, $7::integration_event_status, $8, $9)
  `, [integrationId, direction, eventType, JSON.stringify(payload || {}), responseStatus || null, responseBody || null, status, errorMessage || null, attempts || 1]);
};

const getEventLog = async (integrationId, { page = 1, limit = 50 } = {}) => {
  if (!UUID_REGEX.test(integrationId)) throw createHttpError(400, "Invalid integration ID");
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const [countResult, dataResult] = await Promise.all([
    query("SELECT COUNT(*)::int AS total FROM integration_event_log WHERE integration_id = $1", [integrationId]),
    query(`
      SELECT id, integration_id, direction, event_type, payload, response_status, response_body, status, error_message, attempts, created_at
      FROM integration_event_log WHERE integration_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3
    `, [integrationId, safeLimit, offset])
  ]);

  const total = countResult.rows[0]?.total || 0;
  return {
    items: dataResult.rows.map(formatEventLogEntry),
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) }
  };
};

function formatIntegration(row) {
  return {
    id: row.id,
    name: row.name,
    connectorType: row.connector_type,
    direction: row.direction,
    isEnabled: row.is_enabled,
    config: row.config,
    subscribedEvents: row.subscribed_events,
    authHeaderName: row.auth_header_name,
    authHeaderValue: row.auth_header_value || undefined,
    inboundApiKey: row.inbound_api_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatEventLogEntry(row) {
  return {
    id: row.id,
    integrationId: row.integration_id,
    direction: row.direction,
    eventType: row.event_type,
    payload: row.payload,
    responseStatus: row.response_status,
    responseBody: row.response_body,
    status: row.status,
    errorMessage: row.error_message,
    attempts: row.attempts,
    createdAt: row.created_at
  };
}

module.exports = {
  getConnectorTypes,
  listIntegrations,
  getIntegrationById,
  getIntegrationByInboundKey,
  getIntegrationByConnectorType,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  toggleIntegration,
  testIntegration,
  getEnabledIntegrationsForEvent,
  logIntegrationEvent,
  getEventLog
};
