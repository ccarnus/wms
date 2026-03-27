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

// GET /api/warehouses — list all warehouses with location count
router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        w.id,
        w.code,
        w.name,
        w.created_at AS "createdAt",
        COUNT(l.id)::int AS "locationCount"
      FROM warehouses w
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
        w.created_at AS "createdAt",
        COUNT(l.id)::int AS "locationCount"
      FROM warehouses w
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
router.post("/", async (req, res, next) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) {
      throw badRequest("code and name are required");
    }

    const trimmedCode = String(code).trim();
    const trimmedName = String(name).trim();

    if (trimmedCode.length === 0) throw badRequest("code cannot be empty");
    if (trimmedName.length === 0) throw badRequest("name cannot be empty");

    const { rows } = await query(
      `INSERT INTO warehouses (code, name)
       VALUES ($1, $2)
       RETURNING id, code, name, created_at AS "createdAt"`,
      [trimmedCode, trimmedName]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A warehouse with this code already exists"));
    }
    next(error);
  }
});

// PUT /api/warehouses/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { code, name } = req.body;
    if (!code && !name) throw badRequest("At least one of code or name is required");

    const existing = await query("SELECT id FROM warehouses WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) throw notFound("Warehouse not found");

    const setClauses = [];
    const params = [req.params.id];
    let idx = 2;

    if (code) {
      setClauses.push(`code = $${idx++}`);
      params.push(String(code).trim());
    }
    if (name) {
      setClauses.push(`name = $${idx++}`);
      params.push(String(name).trim());
    }

    const { rows } = await query(
      `UPDATE warehouses SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING id, code, name, created_at AS "createdAt"`,
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
router.delete("/:id", async (req, res, next) => {
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
