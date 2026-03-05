-- 004_integrations.sql — Integration connector tables for WMS

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_direction') THEN
    CREATE TYPE integration_direction AS ENUM ('inbound', 'outbound', 'bidirectional');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_event_status') THEN
    CREATE TYPE integration_event_status AS ENUM ('pending', 'success', 'failed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  direction integration_direction NOT NULL DEFAULT 'outbound',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  subscribed_events TEXT[] NOT NULL DEFAULT '{}',
  auth_header_name TEXT NOT NULL DEFAULT 'X-Webhook-Secret',
  auth_header_value TEXT,
  inbound_api_key TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, event_type, source_field)
);

CREATE TABLE IF NOT EXISTS integration_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  direction integration_direction NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  response_status INT,
  response_body TEXT,
  status integration_event_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_connector_type ON integrations(connector_type);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_integrations_inbound_api_key ON integrations(inbound_api_key) WHERE inbound_api_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_integration_field_mappings_integration_id ON integration_field_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_integration_id ON integration_event_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_created_at ON integration_event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_status ON integration_event_log(status) WHERE status = 'failed';

DROP TRIGGER IF EXISTS trg_integrations_set_updated_at ON integrations;
CREATE TRIGGER trg_integrations_set_updated_at
BEFORE UPDATE ON integrations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
