const express = require("express");
const { query } = require("../db");
const requireRole = require("../middlewares/requireRole");
const { validateWarehousePayload } = require("../services/configValidationService");

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

const WAREHOUSE_COLUMNS = {
  code: "code",
  name: "name",
  address: "address",
  city: "city",
  country: "country",
  isActive: "is_active"
};

const RETURNING_FIELDS = `
  id, code, name, address, city, country,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

// GET /api/warehouses — list all warehouses with zone + location counts
router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        w.id,
        w.code,
        w.name,
        w.address,
        w.city,
        w.country,
        w.is_active AS "isActive",
        w.created_at AS "createdAt",
        w.updated_at AS "updatedAt",
        COUNT(DISTINCT z.id)::int AS "zoneCount",
        COUNT(DISTINCT l.id)::int AS "locationCount"
      FROM warehouses w
      LEFT JOIN zones z ON z.warehouse_id = w.id
      LEFT JOIN locations l ON l.warehouse_id = w.id
      GROUP BY w.id
      ORDER BY w.code`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/warehouses/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        w.id,
        w.code,
        w.name,
        w.address,
        w.city,
        w.country,
        w.is_active AS "isActive",
        w.created_at AS "createdAt",
        w.updated_at AS "updatedAt",
        COUNT(DISTINCT z.id)::int AS "zoneCount",
        COUNT(DISTINCT l.id)::int AS "locationCount"
      FROM warehouses w
      LEFT JOIN zones z ON z.warehouse_id = w.id
      LEFT JOIN locations l ON l.warehouse_id = w.id
      WHERE w.id = $1
      GROUP BY w.id`,
      [req.params.id]
    );
    if (rows.length === 0) throw notFound("Warehouse not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/warehouses
router.post("/", configWrite, async (req, res, next) => {
  try {
    const fields = validateWarehousePayload(req.body);

    const { rows } = await query(
      `INSERT INTO warehouses (code, name, address, city, country, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${RETURNING_FIELDS}`,
      [
        fields.code,
        fields.name,
        fields.address ?? null,
        fields.city ?? null,
        fields.country ?? null,
        fields.isActive ?? true
      ]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A warehouse with this code already exists"));
    }
    next(error);
  }
});

// PUT /api/warehouses/:id — partial update
router.put("/:id", configWrite, async (req, res, next) => {
  try {
    const fields = validateWarehousePayload(req.body, { partial: true });

    const existing = await query("SELECT id FROM warehouses WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) throw notFound("Warehouse not found");

    const setClauses = [];
    const params = [req.params.id];
    let idx = 2;
    for (const [field, value] of Object.entries(fields)) {
      setClauses.push(`${WAREHOUSE_COLUMNS[field]} = $${idx++}`);
      params.push(value);
    }

    const { rows } = await query(
      `UPDATE warehouses SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING ${RETURNING_FIELDS}`,
      params
    );
    res.json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A warehouse with this code already exists"));
    }
    next(error);
  }
});

// DELETE /api/warehouses/:id
router.delete("/:id", configWrite, async (req, res, next) => {
  try {
    const zoneCheck = await query("SELECT id FROM zones WHERE warehouse_id = $1 LIMIT 1", [req.params.id]);
    if (zoneCheck.rowCount > 0) {
      throw badRequest("Cannot delete warehouse that still has zones. Remove or reassign zones first.");
    }

    const { rowCount } = await query("DELETE FROM warehouses WHERE id = $1", [req.params.id]);
    if (rowCount === 0) throw notFound("Warehouse not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
