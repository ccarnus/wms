-- 001_schema.sql — Complete WMS database schema

-- ── Extensions ──────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operator_status') THEN
  CREATE TYPE operator_status AS ENUM ('available', 'busy', 'offline');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zone_type') THEN
  CREATE TYPE zone_type AS ENUM ('pick', 'bulk', 'dock', 'staging');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_status') THEN
  CREATE TYPE location_status AS ENUM ('active', 'locked');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type') THEN
  CREATE TYPE location_type AS ENUM ('rack', 'shelf', 'bin', 'floor', 'dock', 'staging');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
  CREATE TYPE task_type AS ENUM ('pick', 'putaway', 'replenish', 'count');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
  CREATE TYPE task_status AS ENUM (
    'created', 'assigned', 'in_progress', 'paused',
    'completed', 'cancelled', 'failed'
  );
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_line_status') THEN
  CREATE TYPE task_line_status AS ENUM (
    'created', 'in_progress', 'completed', 'cancelled', 'failed'
  );
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
  CREATE TYPE user_role AS ENUM (
    'admin', 'warehouse_manager', 'supervisor', 'operator', 'viewer'
  );
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_direction') THEN
  CREATE TYPE integration_direction AS ENUM ('inbound', 'outbound', 'bidirectional');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_event_status') THEN
  CREATE TYPE integration_event_status AS ENUM ('pending', 'success', 'failed');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_order_status') THEN
  CREATE TYPE sales_order_status AS ENUM (
    'pending_inventory', 'ready', 'released', 'completed', 'cancelled'
  );
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_order_line_status') THEN
  CREATE TYPE sales_order_line_status AS ENUM ('pending', 'resolved', 'short');
END IF; END$$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_alert_status') THEN
  CREATE TYPE inventory_alert_status AS ENUM ('active', 'resolved', 'dismissed');
END IF; END$$;

-- ── Core tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type zone_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, name)
);

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status location_status NOT NULL DEFAULT 'active',
  type location_type NOT NULL DEFAULT 'rack',
  capacity INT NOT NULL DEFAULT 1000 CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS skus (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  weight_kg DOUBLE PRECISION,
  dimension_x_cm DOUBLE PRECISION,
  dimension_y_cm DOUBLE PRECISION,
  dimension_z_cm DOUBLE PRECISION,
  picture_url TEXT,
  barcodes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  sku_id INT NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sku_id, location_id)
);

CREATE TABLE IF NOT EXISTS movements (
  id SERIAL PRIMARY KEY,
  sku_id INT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  from_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT')),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Operators & zones ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status operator_status NOT NULL DEFAULT 'offline',
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  performance_score DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (performance_score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operator_zones (
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (operator_id, zone_id)
);

-- ── Tasks ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type task_type NOT NULL,
  priority INT NOT NULL DEFAULT 0 CHECK (priority >= 0),
  status task_status NOT NULL DEFAULT 'created',
  zone_id UUID REFERENCES zones(id) ON DELETE RESTRICT,
  assigned_operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  source_document_id TEXT NOT NULL,
  estimated_time_seconds INT NOT NULL CHECK (estimated_time_seconds >= 0),
  actual_time_seconds INT CHECK (actual_time_seconds >= 0),
  version INT NOT NULL DEFAULT 1 CHECK (version > 0),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE IF NOT EXISTS task_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sku_id INT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  from_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  status task_line_status NOT NULL DEFAULT 'created'
);

CREATE TABLE IF NOT EXISTS task_status_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status task_status NOT NULL,
  to_status task_status NOT NULL,
  task_version INT NOT NULL CHECK (task_version > 0),
  changed_by_operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('sales_order_ready_for_pick', 'purchase_order_received')),
  source_document_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Labor ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS labor_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tasks_completed INT NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  units_processed INT NOT NULL DEFAULT 0 CHECK (units_processed >= 0),
  avg_task_time DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (avg_task_time >= 0),
  utilization_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (
    utilization_percent >= 0 AND utilization_percent <= 100
  ),
  UNIQUE (operator_id, date)
);

-- ── Users ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sales Orders ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL UNIQUE,
  status sales_order_status NOT NULL DEFAULT 'pending_inventory',
  ship_date TIMESTAMPTZ NOT NULL,
  priority INT NOT NULL DEFAULT 0 CHECK (priority >= 0),
  released_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  event_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  sku_id INT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  pick_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  available_quantity INT NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  status sales_order_line_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  sales_order_line_id UUID NOT NULL REFERENCES sales_order_lines(id) ON DELETE CASCADE,
  sku_id INT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  required_quantity INT NOT NULL CHECK (required_quantity > 0),
  available_quantity INT NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  shortage INT NOT NULL GENERATED ALWAYS AS (required_quantity - available_quantity) STORED,
  status inventory_alert_status NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Integrations ────────────────────────────────────────────────────

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

-- ── Indexes ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_zone_id ON locations(zone_id);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_operators_status ON operators(status);
CREATE INDEX IF NOT EXISTS idx_operator_zones_zone_id ON operator_zones(zone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_operator_id ON tasks(assigned_operator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_zone_id ON tasks(zone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_priority ON tasks(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_active_operator ON tasks(assigned_operator_id)
  WHERE status IN ('assigned'::task_status, 'in_progress'::task_status, 'paused'::task_status);
CREATE INDEX IF NOT EXISTS idx_task_lines_task_id ON task_lines(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_audit_logs_task_id ON task_status_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_audit_logs_changed_at ON task_status_audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_generation_events_processed_at ON task_generation_events(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_labor_daily_metrics_operator_id ON labor_daily_metrics(operator_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_operator_id ON users(operator_id) WHERE operator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_source_document_id ON sales_orders(source_document_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_pending ON sales_orders(priority DESC, created_at ASC)
  WHERE status = 'pending_inventory';
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_sales_order_id ON sales_order_lines(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_sku_id ON sales_order_lines(sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_status ON inventory_alerts(status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_sales_order_id ON inventory_alerts(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_sku_id ON inventory_alerts(sku_id);
CREATE INDEX IF NOT EXISTS idx_integrations_connector_type ON integrations(connector_type);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_integrations_inbound_api_key ON integrations(inbound_api_key) WHERE inbound_api_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_integration_field_mappings_integration_id ON integration_field_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_integration_id ON integration_event_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_created_at ON integration_event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_status ON integration_event_log(status) WHERE status = 'failed';

-- ── Trigger function & triggers ─────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_skus_set_updated_at ON skus;
CREATE TRIGGER trg_skus_set_updated_at
  BEFORE UPDATE ON skus FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_locations_set_updated_at ON locations;
CREATE TRIGGER trg_locations_set_updated_at
  BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_operators_set_updated_at ON operators;
CREATE TRIGGER trg_operators_set_updated_at
  BEFORE UPDATE ON operators FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_zones_set_updated_at ON zones;
CREATE TRIGGER trg_zones_set_updated_at
  BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_tasks_set_updated_at ON tasks;
CREATE TRIGGER trg_tasks_set_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_sales_orders_set_updated_at ON sales_orders;
CREATE TRIGGER trg_sales_orders_set_updated_at
  BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_integrations_set_updated_at ON integrations;
CREATE TRIGGER trg_integrations_set_updated_at
  BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- ── Outbound (Pack & Ship) ───────────────────────────────────────────

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'pack';
ALTER TYPE zone_type ADD VALUE IF NOT EXISTS 'packing';

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
  CREATE TYPE shipment_status AS ENUM ('pending', 'labeled', 'dispatched', 'delivered');
END IF; END$$;

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  pack_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status shipment_status NOT NULL DEFAULT 'pending',
  carrier TEXT,
  tracking_number TEXT,
  label_url TEXT,
  box_type TEXT,
  weight_grams INT CHECK (weight_grams IS NULL OR weight_grams > 0),
  length_cm INT CHECK (length_cm IS NULL OR length_cm > 0),
  width_cm INT CHECK (width_cm IS NULL OR width_cm > 0),
  height_cm INT CHECK (height_cm IS NULL OR height_cm > 0),
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sales_order_id)
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status);
CREATE INDEX IF NOT EXISTS idx_shipments_sales_order_id ON shipments (sales_order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_pack_task_id ON shipments (pack_task_id) WHERE pack_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments (created_at DESC);

DROP TRIGGER IF EXISTS trg_shipments_set_updated_at ON shipments;
CREATE TRIGGER trg_shipments_set_updated_at
  BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- ── Purchase Orders ──────────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
  CREATE TYPE purchase_order_status AS ENUM ('received', 'pending_capacity', 'in_progress', 'completed', 'cancelled');
END IF; END$$;

ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'pending_capacity';

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_line_status') THEN
  CREATE TYPE purchase_order_line_status AS ENUM ('pending', 'putaway', 'cancelled');
END IF; END$$;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL UNIQUE,
  status purchase_order_status NOT NULL DEFAULT 'received',
  strategy TEXT NOT NULL CHECK (strategy IN ('RANDOM', 'CONSOLIDATION', 'EMPTY')),
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sku_id INT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  destination_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  status purchase_order_line_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_pending_capacity ON purchase_orders(created_at ASC)
  WHERE status = 'pending_capacity';
CREATE INDEX IF NOT EXISTS idx_purchase_orders_source_document_id ON purchase_orders(source_document_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_purchase_order_id ON purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_sku_id ON purchase_order_lines(sku_id);

DROP TRIGGER IF EXISTS trg_purchase_orders_set_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_set_updated_at
  BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
