const express = require("express");
const { query } = require("../db");
const requireRole = require("../middlewares/requireRole");
const {
  LOCATION_STATUSES,
  validateLocationPayload,
  validateBulkLocationPayload
} = require("../services/configValidationService");

const router = express.Router();

const configWrite = requireRole("admin", "warehouse_manager");

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const notFound = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

const LOCATION_COLUMNS = {
  name: "name",
  status: "status",
  type: "type",
  capacity: "capacity",
  zoneId: "zone_id"
};

const COLUMN_CASTS = {
  status: "::location_status",
  type: "::location_type"
};

const RETURNING_FIELDS = `
  id, warehouse_id AS "warehouseId", zone_id AS "zoneId", code, name, status, type, capacity,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

// GET /api/locations — list all locations with zone + warehouse info and stock usage
router.get("/", async (req, res, next) => {
  try {
    const { warehouseId, zoneId, status, search } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (warehouseId) {
      conditions.push(`l.warehouse_id = $${idx++}`);
      params.push(Number(warehouseId));
    }
    if (zoneId) {
      conditions.push(`l.zone_id = $${idx++}`);
      params.push(zoneId);
    }
    if (status && LOCATION_STATUSES.includes(status)) {
      conditions.push(`l.status = $${idx++}::location_status`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(l.code ILIKE $${idx} OR l.name ILIKE $${idx})`);
      params.push(`%${String(search).trim()}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT
        l.id,
        l.code,
        l.name,
        l.status,
        l.type,
        l.capacity,
        l.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        l.zone_id AS "zoneId",
        z.name AS "zoneName",
        z.type AS "zoneType",
        l.created_at AS "createdAt",
        l.updated_at AS "updatedAt",
        COALESCE(SUM(i.quantity), 0)::int AS "usedCapacity"
      FROM locations l
      INNER JOIN warehouses w ON w.id = l.warehouse_id
      INNER JOIN zones z ON z.id = l.zone_id
      LEFT JOIN inventory i ON i.location_id = l.id
      ${where}
      GROUP BY l.id, w.id, z.id
      ORDER BY w.code, z.name, l.code`,
      params
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/locations/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        l.id,
        l.code,
        l.name,
        l.status,
        l.type,
        l.capacity,
        l.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        l.zone_id AS "zoneId",
        z.name AS "zoneName",
        z.type AS "zoneType",
        l.created_at AS "createdAt",
        l.updated_at AS "updatedAt",
        COALESCE(SUM(i.quantity), 0)::int AS "usedCapacity"
      FROM locations l
      INNER JOIN warehouses w ON w.id = l.warehouse_id
      INNER JOIN zones z ON z.id = l.zone_id
      LEFT JOIN inventory i ON i.location_id = l.id
      WHERE l.id = $1
      GROUP BY l.id, w.id, z.id`,
      [req.params.id]
    );
    if (rows.length === 0) throw notFound("Location not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/locations
router.post("/", configWrite, async (req, res, next) => {
  try {
    const fields = validateLocationPayload(req.body);

    const zoneCheck = await query("SELECT id, warehouse_id FROM zones WHERE id = $1", [fields.zoneId]);
    if (zoneCheck.rowCount === 0) throw badRequest("Unknown zoneId");
    const warehouseId = zoneCheck.rows[0].warehouse_id;

    const { rows } = await query(
      `INSERT INTO locations (warehouse_id, zone_id, code, name, status, type, capacity)
       VALUES ($1, $2, $3, $4, $5::location_status, $6::location_type, $7)
       RETURNING ${RETURNING_FIELDS}`,
      [warehouseId, fields.zoneId, fields.code, fields.name, fields.status, fields.type, fields.capacity]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A location with this code already exists in this warehouse"));
    }
    next(error);
  }
});

// POST /api/locations/bulk — generate a range of locations from a code pattern
router.post("/bulk", configWrite, async (req, res, next) => {
  try {
    const { zoneId, status, type, capacity, codes } = validateBulkLocationPayload(req.body);

    const zoneCheck = await query("SELECT id, warehouse_id FROM zones WHERE id = $1", [zoneId]);
    if (zoneCheck.rowCount === 0) throw badRequest("Unknown zoneId");
    const warehouseId = zoneCheck.rows[0].warehouse_id;

    // Existing codes (same warehouse) are skipped, not treated as errors.
    const { rows } = await query(
      `INSERT INTO locations (warehouse_id, zone_id, code, name, status, type, capacity)
       SELECT $1, $2, code, code, $3::location_status, $4::location_type, $5
       FROM UNNEST($6::text[]) AS code
       ON CONFLICT (warehouse_id, code) DO NOTHING
       RETURNING ${RETURNING_FIELDS}`,
      [warehouseId, zoneId, status, type, capacity, codes]
    );

    res.status(201).json({
      requested: codes.length,
      created: rows.length,
      skipped: codes.length - rows.length,
      locations: rows
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/locations/:id — partial update
router.put("/:id", configWrite, async (req, res, next) => {
  try {
    const fields = validateLocationPayload(req.body, { partial: true });

    const existing = await query("SELECT id, warehouse_id FROM locations WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) throw notFound("Location not found");

    if (fields.zoneId !== undefined) {
      const zoneCheck = await query(
        "SELECT id FROM zones WHERE id = $1 AND warehouse_id = $2",
        [fields.zoneId, existing.rows[0].warehouse_id]
      );
      if (zoneCheck.rowCount === 0) {
        throw badRequest("Zone not found or belongs to a different warehouse");
      }
    }

    const setClauses = [];
    const params = [req.params.id];
    let idx = 2;
    for (const [field, value] of Object.entries(fields)) {
      setClauses.push(`${LOCATION_COLUMNS[field]} = $${idx++}${COLUMN_CASTS[field] || ""}`);
      params.push(value);
    }

    const { rows } = await query(
      `UPDATE locations SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING ${RETURNING_FIELDS}`,
      params
    );
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/locations/:id/status — toggle active/locked
router.patch("/:id/status", configWrite, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !LOCATION_STATUSES.includes(status)) {
      throw badRequest(`status must be one of: ${LOCATION_STATUSES.join(", ")}`);
    }

    const { rows } = await query(
      `UPDATE locations SET status = $2::location_status WHERE id = $1
       RETURNING ${RETURNING_FIELDS}`,
      [req.params.id, status]
    );
    if (rows.length === 0) throw notFound("Location not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/locations/:id
router.delete("/:id", configWrite, async (req, res, next) => {
  try {
    const invCheck = await query("SELECT id FROM inventory WHERE location_id = $1 AND quantity > 0 LIMIT 1", [req.params.id]);
    if (invCheck.rowCount > 0) {
      throw badRequest("Cannot delete location with inventory. Move or adjust stock first.");
    }

    const taskCheck = await query(
      `SELECT id FROM task_lines
       WHERE (from_location_id = $1 OR to_location_id = $1)
         AND status NOT IN ('completed', 'cancelled', 'failed')
       LIMIT 1`,
      [req.params.id]
    );
    if (taskCheck.rowCount > 0) {
      throw badRequest("Cannot delete location referenced by active task lines");
    }

    const { rowCount } = await query("DELETE FROM locations WHERE id = $1", [req.params.id]);
    if (rowCount === 0) throw notFound("Location not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
