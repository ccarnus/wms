const express = require("express");
const { query } = require("../db");
const requireRole = require("../middlewares/requireRole");
const { validateZonePayload } = require("../services/configValidationService");

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

const ZONE_COLUMNS = {
  name: "name",
  type: "type",
  description: "description"
};

// GET /api/zones — list all zones with location count
router.get("/", async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    let sql = `
      SELECT
        z.id,
        z.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        z.name,
        z.type,
        z.description,
        z.created_at AS "createdAt",
        z.updated_at AS "updatedAt",
        COUNT(l.id)::int AS "locationCount"
      FROM zones z
      INNER JOIN warehouses w ON w.id = z.warehouse_id
      LEFT JOIN locations l ON l.zone_id = z.id
    `;
    const params = [];
    if (warehouseId) {
      params.push(Number(warehouseId));
      sql += ` WHERE z.warehouse_id = $1`;
    }
    sql += ` GROUP BY z.id, w.id ORDER BY w.code, z.name`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/zones/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        z.id,
        z.warehouse_id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        z.name,
        z.type,
        z.description,
        z.created_at AS "createdAt",
        z.updated_at AS "updatedAt"
      FROM zones z
      INNER JOIN warehouses w ON w.id = z.warehouse_id
      WHERE z.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) throw notFound("Zone not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/zones
router.post("/", configWrite, async (req, res, next) => {
  try {
    const fields = validateZonePayload(req.body);

    const whCheck = await query("SELECT id FROM warehouses WHERE id = $1", [fields.warehouseId]);
    if (whCheck.rowCount === 0) throw badRequest("Unknown warehouseId");

    const { rows } = await query(
      `INSERT INTO zones (warehouse_id, name, type, description)
       VALUES ($1, $2, $3::zone_type, $4)
       RETURNING id, warehouse_id AS "warehouseId", name, type, description,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [fields.warehouseId, fields.name, fields.type, fields.description ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A zone with this name already exists in this warehouse"));
    }
    next(error);
  }
});

// PUT /api/zones/:id — partial update
router.put("/:id", configWrite, async (req, res, next) => {
  try {
    const fields = validateZonePayload(req.body, { partial: true });

    const existing = await query("SELECT id FROM zones WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) throw notFound("Zone not found");

    const setClauses = [];
    const params = [req.params.id];
    let idx = 2;
    for (const [field, value] of Object.entries(fields)) {
      const cast = field === "type" ? "::zone_type" : "";
      setClauses.push(`${ZONE_COLUMNS[field]} = $${idx++}${cast}`);
      params.push(value);
    }

    const { rows } = await query(
      `UPDATE zones SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING id, warehouse_id AS "warehouseId", name, type, description,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      params
    );
    res.json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A zone with this name already exists in this warehouse"));
    }
    next(error);
  }
});

// DELETE /api/zones/:id
router.delete("/:id", configWrite, async (req, res, next) => {
  try {
    const locCheck = await query("SELECT id FROM locations WHERE zone_id = $1 LIMIT 1", [req.params.id]);
    if (locCheck.rowCount > 0) {
      throw badRequest("Cannot delete zone that still has locations. Remove or reassign locations first.");
    }

    const taskCheck = await query(
      "SELECT id FROM tasks WHERE zone_id = $1 AND status NOT IN ('completed', 'cancelled', 'failed') LIMIT 1",
      [req.params.id]
    );
    if (taskCheck.rowCount > 0) {
      throw badRequest("Cannot delete zone with active tasks");
    }

    const { rowCount } = await query("DELETE FROM zones WHERE id = $1", [req.params.id]);
    if (rowCount === 0) throw notFound("Zone not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
