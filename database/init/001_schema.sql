CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, location_id)
);

CREATE TABLE IF NOT EXISTS movements (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  from_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT')),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);

INSERT INTO warehouses (code, name)
VALUES
  ('PARIS-01', 'Paris Main Warehouse'),
  ('LILLE-01', 'Lille Overflow Warehouse')
ON CONFLICT (code) DO NOTHING;

INSERT INTO locations (warehouse_id, code, name)
SELECT w.id, s.code, s.name
FROM (
  VALUES
    ('PARIS-01', 'PAR-DOCK-IN', 'Inbound Dock'),
    ('PARIS-01', 'PAR-RACK-A1', 'Rack A1'),
    ('LILLE-01', 'LIL-RACK-B1', 'Rack B1')
) AS s(warehouse_code, code, name)
JOIN warehouses w ON w.code = s.warehouse_code
ON CONFLICT (warehouse_id, code) DO NOTHING;

INSERT INTO products (sku, name)
VALUES
  ('SKU-100', 'Storage Bin Small'),
  ('SKU-200', 'Storage Bin Large'),
  ('SKU-300', 'Barcode Scanner')
ON CONFLICT (sku) DO NOTHING;

INSERT INTO inventory (product_id, location_id, quantity)
SELECT p.id, l.id, s.quantity
FROM (
  VALUES
    ('SKU-100', 'PAR-RACK-A1', 80),
    ('SKU-200', 'PAR-RACK-A1', 30),
    ('SKU-300', 'LIL-RACK-B1', 12)
) AS s(sku, location_code, quantity)
JOIN products p ON p.sku = s.sku
JOIN locations l ON l.code = s.location_code
ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operator_status') THEN
    CREATE TYPE operator_status AS ENUM ('available', 'busy', 'offline');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zone_type') THEN
    CREATE TYPE zone_type AS ENUM ('pick', 'bulk', 'dock', 'staging');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
    CREATE TYPE task_type AS ENUM ('pick', 'putaway', 'replenish', 'count');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM (
      'created',
      'assigned',
      'in_progress',
      'paused',
      'completed',
      'cancelled',
      'failed'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_line_status') THEN
    CREATE TYPE task_line_status AS ENUM (
      'created',
      'in_progress',
      'completed',
      'cancelled',
      'failed'
    );
  END IF;
END$$;

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

CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type zone_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, name)
);

CREATE TABLE IF NOT EXISTS operator_zones (
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (operator_id, zone_id)
);

CREATE TABLE IF NOT EXISTS location_zones (
  location_id INT PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type task_type NOT NULL,
  priority INT NOT NULL DEFAULT 0 CHECK (priority >= 0),
  status task_status NOT NULL DEFAULT 'created',
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
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
  sku_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  from_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id INT REFERENCES locations(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  status task_line_status NOT NULL DEFAULT 'created'
);

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

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_operator_id ON tasks(assigned_operator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_zone_id ON tasks(zone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_priority ON tasks(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_active_operator ON tasks(assigned_operator_id)
WHERE status IN ('assigned'::task_status, 'in_progress'::task_status, 'paused'::task_status);
CREATE INDEX IF NOT EXISTS idx_task_lines_task_id ON task_lines(task_id);
CREATE INDEX IF NOT EXISTS idx_labor_daily_metrics_operator_id ON labor_daily_metrics(operator_id);
CREATE INDEX IF NOT EXISTS idx_task_status_audit_logs_task_id ON task_status_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_audit_logs_changed_at ON task_status_audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_operators_status ON operators(status);
CREATE INDEX IF NOT EXISTS idx_operator_zones_zone_id ON operator_zones(zone_id);
CREATE INDEX IF NOT EXISTS idx_location_zones_zone_id ON location_zones(zone_id);
CREATE INDEX IF NOT EXISTS idx_task_generation_events_processed_at ON task_generation_events(processed_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_operators_set_updated_at ON operators;
CREATE TRIGGER trg_operators_set_updated_at
BEFORE UPDATE ON operators
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_zones_set_updated_at ON zones;
CREATE TRIGGER trg_zones_set_updated_at
BEFORE UPDATE ON zones
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_tasks_set_updated_at ON tasks;
CREATE TRIGGER trg_tasks_set_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
