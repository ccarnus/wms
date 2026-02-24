const express = require("express");
const { pool, query } = require("../db");

const router = express.Router();

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const ensurePositiveInteger = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }
  return parsed;
};

router.get("/summary", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        (SELECT COUNT(*) FROM warehouses)::int AS "warehouseCount",
        (SELECT COUNT(*) FROM locations)::int AS "locationCount",
        (SELECT COUNT(*) FROM products)::int AS "productCount",
        (SELECT COALESCE(SUM(quantity), 0) FROM inventory)::int AS "totalUnits"`
    );
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/warehouses", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        w.id,
        w.code,
        w.name,
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

router.get("/locations", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        l.id,
        l.code,
        l.name,
        w.id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName"
      FROM locations l
      INNER JOIN warehouses w ON w.id = l.warehouse_id
      ORDER BY w.code, l.code`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/products", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        p.id,
        p.sku,
        p.name,
        COALESCE(SUM(i.quantity), 0)::int AS "totalQuantity"
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      GROUP BY p.id
      ORDER BY p.sku`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        i.id,
        p.id AS "productId",
        p.sku,
        p.name AS "productName",
        l.id AS "locationId",
        l.code AS "locationCode",
        l.name AS "locationName",
        w.id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        i.quantity
      FROM inventory i
      INNER JOIN products p ON p.id = i.product_id
      INNER JOIN locations l ON l.id = i.location_id
      INNER JOIN warehouses w ON w.id = l.warehouse_id
      ORDER BY p.sku, w.code, l.code`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/movements", async (req, res, next) => {
  try {
    const rawLimit = req.query.limit ?? 20;
    const limit = Math.min(100, ensurePositiveInteger(rawLimit, "limit"));
    const { rows } = await query(
      `SELECT
        m.id,
        m.product_id AS "productId",
        p.sku,
        p.name AS "productName",
        m.from_location_id AS "fromLocationId",
        from_loc.code AS "fromLocationCode",
        m.to_location_id AS "toLocationId",
        to_loc.code AS "toLocationCode",
        m.quantity,
        m.movement_type AS "movementType",
        m.reference,
        m.created_at AS "createdAt"
      FROM movements m
      INNER JOIN products p ON p.id = m.product_id
      LEFT JOIN locations from_loc ON from_loc.id = m.from_location_id
      LEFT JOIN locations to_loc ON to_loc.id = m.to_location_id
      ORDER BY m.created_at DESC
      LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/movements", async (req, res, next) => {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    const productId = ensurePositiveInteger(req.body.productId, "productId");
    const quantity = ensurePositiveInteger(req.body.quantity, "quantity");
    const fromLocationId = req.body.fromLocationId ? ensurePositiveInteger(req.body.fromLocationId, "fromLocationId") : null;
    const toLocationId = req.body.toLocationId ? ensurePositiveInteger(req.body.toLocationId, "toLocationId") : null;
    const reference = req.body.reference ? String(req.body.reference).trim().slice(0, 120) : null;

    if (!fromLocationId && !toLocationId) {
      throw badRequest("Either fromLocationId or toLocationId must be provided");
    }
    if (fromLocationId && toLocationId && fromLocationId === toLocationId) {
      throw badRequest("fromLocationId and toLocationId cannot be the same");
    }

    const movementType = fromLocationId && toLocationId ? "TRANSFER" : fromLocationId ? "OUTBOUND" : "INBOUND";

    await client.query("BEGIN");
    inTransaction = true;

    const productCheck = await client.query("SELECT id FROM products WHERE id = $1", [productId]);
    if (productCheck.rowCount === 0) {
      throw badRequest("Unknown productId");
    }

    if (fromLocationId) {
      const sourceCheck = await client.query("SELECT id FROM locations WHERE id = $1", [fromLocationId]);
      if (sourceCheck.rowCount === 0) {
        throw badRequest("Unknown fromLocationId");
      }

      const sourceStock = await client.query(
        `SELECT quantity
         FROM inventory
         WHERE product_id = $1 AND location_id = $2
         FOR UPDATE`,
        [productId, fromLocationId]
      );

      const sourceQty = sourceStock.rowCount > 0 ? sourceStock.rows[0].quantity : 0;
      if (sourceQty < quantity) {
        throw badRequest("Insufficient stock in source location");
      }

      await client.query(
        `UPDATE inventory
         SET quantity = quantity - $1,
             updated_at = NOW()
         WHERE product_id = $2 AND location_id = $3`,
        [quantity, productId, fromLocationId]
      );
    }

    if (toLocationId) {
      const destinationCheck = await client.query("SELECT id FROM locations WHERE id = $1", [toLocationId]);
      if (destinationCheck.rowCount === 0) {
        throw badRequest("Unknown toLocationId");
      }

      await client.query(
        `INSERT INTO inventory (product_id, location_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, location_id)
         DO UPDATE SET
           quantity = inventory.quantity + EXCLUDED.quantity,
           updated_at = NOW()`,
        [productId, toLocationId, quantity]
      );
    }

    const movementInsert = await client.query(
      `INSERT INTO movements (
        product_id,
        from_location_id,
        to_location_id,
        quantity,
        movement_type,
        reference
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        product_id AS "productId",
        from_location_id AS "fromLocationId",
        to_location_id AS "toLocationId",
        quantity,
        movement_type AS "movementType",
        reference,
        created_at AS "createdAt"`,
      [productId, fromLocationId, toLocationId, quantity, movementType, reference]
    );

    await client.query("COMMIT");
    inTransaction = false;
    res.status(201).json(movementInsert.rows[0]);
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
