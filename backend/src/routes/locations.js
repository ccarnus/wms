const express = require("express");
const { query } = require("../db");

const router = express.Router();

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

const VALID_STATUSES = ["active", "locked"];
const VALID_TYPES = ["rack", "shelf", "bin", "floor", "dock", "staging"];

// GET /api/locations — list all locations with zone + warehouse info
router.get("/", async (req, res, next) => {
  try {
    const { warehouseId, zoneId, status } = req.query;
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
    if (status && VALID_STATUSES.includes(status)) {
      conditions.push(`l.status = $${idx++}::location_status`);
      params.push(status);
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
        l.updated_at AS "updatedAt"
      FROM locations l
      INNER JOIN warehouses w ON w.id = l.warehouse_id
      INNER JOIN zones z ON z.id = l.zone_id
      ${where}
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
        l.updated_at AS "updatedAt"
      FROM locations l
      INNER JOIN warehouses w ON w.id = l.warehouse_id
      INNER JOIN zones z ON z.id = l.zone_id
      WHERE l.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) throw notFound("Location not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/locations
router.post("/", async (req, res, next) => {
  try {
    const { zoneId, code, name, status, type, capacity } = req.body;

    if (!zoneId || !code || !name) {
      throw badRequest("zoneId, code, and name are required");
    }

    // Validate zone exists and get its warehouse_id
    const zoneCheck = await query("SELECT id, warehouse_id FROM zones WHERE id = $1", [zoneId]);
    if (zoneCheck.rowCount === 0) throw badRequest("Unknown zoneId");
    const warehouseId = zoneCheck.rows[0].warehouse_id;

    const locStatus = status || "active";
    if (!VALID_STATUSES.includes(locStatus)) {
      throw badRequest(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    const locType = type || "rack";
    if (!VALID_TYPES.includes(locType)) {
      throw badRequest(`type must be one of: ${VALID_TYPES.join(", ")}`);
    }

    const locCapacity = capacity ? Number(capacity) : 1000;
    if (!Number.isInteger(locCapacity) || locCapacity <= 0) {
      throw badRequest("capacity must be a positive integer");
    }

    const { rows } = await query(
      `INSERT INTO locations (warehouse_id, zone_id, code, name, status, type, capacity)
       VALUES ($1, $2, $3, $4, $5::location_status, $6::location_type, $7)
       RETURNING id, warehouse_id AS "warehouseId", zone_id AS "zoneId", code, name, status, type, capacity,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [warehouseId, zoneId, code.trim(), name.trim(), locStatus, locType, locCapacity]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A location with this code already exists in this warehouse"));
    }
    next(error);
  }
});

// PUT /api/locations/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { name, status, type, capacity, zoneId } = req.body;
    if (!name && !status && !type && !capacity && !zoneId) {
      throw badRequest("At least one field to update is required");
    }

    const existing = await query("SELECT id, warehouse_id FROM locations WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) throw notFound("Location not found");

    if (status && !VALID_STATUSES.includes(status)) {
      throw badRequest(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    if (type && !VALID_TYPES.includes(type)) {
      throw badRequest(`type must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (capacity !== undefined) {
      const cap = Number(capacity);
      if (!Number.isInteger(cap) || cap <= 0) {
        throw badRequest("capacity must be a positive integer");
      }
    }

    if (zoneId) {
      const zoneCheck = await query(
        "SELECT id FROM zones WHERE id = $1 AND warehouse_id = $2",
        [zoneId, existing.rows[0].warehouse_id]
      );
      if (zoneCheck.rowCount === 0) {
        throw badRequest("Zone not found or belongs to a different warehouse");
      }
    }

    const setClauses = [];
    const params = [req.params.id];
    let idx = 2;

    if (name) { setClauses.push(`name = $${idx++}`); params.push(name.trim()); }
    if (status) { setClauses.push(`status = $${idx++}::location_status`); params.push(status); }
    if (type) { setClauses.push(`type = $${idx++}::location_type`); params.push(type); }
    if (capacity !== undefined) { setClauses.push(`capacity = $${idx++}`); params.push(Number(capacity)); }
    if (zoneId) { setClauses.push(`zone_id = $${idx++}`); params.push(zoneId); }

    const { rows } = await query(
      `UPDATE locations SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING id, warehouse_id AS "warehouseId", zone_id AS "zoneId", code, name, status, type, capacity,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      params
    );
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/locations/:id/status — toggle active/locked
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      throw badRequest(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    const { rows } = await query(
      `UPDATE locations SET status = $2::location_status WHERE id = $1
       RETURNING id, warehouse_id AS "warehouseId", zone_id AS "zoneId", code, name, status, type, capacity,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, status]
    );
    if (rows.length === 0) throw notFound("Location not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/locations/:id
router.delete("/:id", async (req, res, next) => {
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
