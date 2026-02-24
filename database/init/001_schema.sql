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
