-- 005_locations_zones_rework.sql
-- Rework: Warehouse → Zone → Location hierarchy
-- Zones now contain locations (not the other way around via junction table).

-- ── New enums ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_status') THEN
    CREATE TYPE location_status AS ENUM ('active', 'locked');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type') THEN
    CREATE TYPE location_type AS ENUM ('rack', 'shelf', 'bin', 'floor', 'dock', 'staging');
  END IF;
END$$;

-- ── Add new columns to locations ────────────────────────────────────

ALTER TABLE locations ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE RESTRICT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS status location_status NOT NULL DEFAULT 'active';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS type location_type NOT NULL DEFAULT 'rack';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 1000 CHECK (capacity > 0);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Backfill zone_id from location_zones junction table ─────────────

UPDATE locations l
SET zone_id = lz.zone_id
FROM location_zones lz
WHERE lz.location_id = l.id
  AND l.zone_id IS NULL;

-- ── Make zone_id NOT NULL (after backfill) ──────────────────────────

DO $$
BEGIN
  -- Only set NOT NULL if not already set
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'zone_id' AND is_nullable = 'YES'
  ) THEN
    -- Assign unlinked locations to the first zone in their warehouse
    UPDATE locations l
    SET zone_id = (
      SELECT z.id FROM zones z WHERE z.warehouse_id = l.warehouse_id LIMIT 1
    )
    WHERE l.zone_id IS NULL;

    ALTER TABLE locations ALTER COLUMN zone_id SET NOT NULL;
  END IF;
END$$;

-- ── Drop the junction table ─────────────────────────────────────────

DROP INDEX IF EXISTS idx_location_zones_zone_id;
DROP TABLE IF EXISTS location_zones;

-- ── New indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_locations_zone_id ON locations(zone_id);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status) WHERE status = 'active';

-- ── Updated_at trigger for locations ────────────────────────────────

DROP TRIGGER IF EXISTS trg_locations_set_updated_at ON locations;
CREATE TRIGGER trg_locations_set_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
