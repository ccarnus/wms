const express = require("express");
const { pool, query } = require("../db");
const { publishRealtimeEvent } = require("../realtime/eventBus");

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
        (SELECT COUNT(*) FROM skus)::int AS "skuCount",
        (SELECT COALESCE(SUM(quantity), 0) FROM inventory)::int AS "totalUnits"`
    );
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        i.id,
        s.id AS "skuId",
        s.sku,
        s.description AS "skuDescription",
        l.id AS "locationId",
        l.code AS "locationCode",
        l.name AS "locationName",
        w.id AS "warehouseId",
        w.code AS "warehouseCode",
        w.name AS "warehouseName",
        i.quantity
      FROM inventory i
      INNER JOIN skus s ON s.id = i.sku_id
      INNER JOIN locations l ON l.id = i.location_id
      INNER JOIN warehouses w ON w.id = l.warehouse_id
      ORDER BY s.sku, w.code, l.code`
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
        m.sku_id AS "skuId",
        s.sku,
        s.description AS "skuDescription",
        m.from_location_id AS "fromLocationId",
        from_loc.code AS "fromLocationCode",
        m.to_location_id AS "toLocationId",
        to_loc.code AS "toLocationCode",
        m.quantity,
        m.movement_type AS "movementType",
        m.reference,
        m.created_at AS "createdAt"
      FROM movements m
      INNER JOIN skus s ON s.id = m.sku_id
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
    const skuId = ensurePositiveInteger(req.body.skuId, "skuId");
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

    const skuCheck = await client.query("SELECT id FROM skus WHERE id = $1", [skuId]);
    if (skuCheck.rowCount === 0) {
      throw badRequest("Unknown skuId");
    }

    if (fromLocationId) {
      const sourceCheck = await client.query("SELECT id FROM locations WHERE id = $1", [fromLocationId]);
      if (sourceCheck.rowCount === 0) {
        throw badRequest("Unknown fromLocationId");
      }

      const sourceStock = await client.query(
        `SELECT quantity
         FROM inventory
         WHERE sku_id = $1 AND location_id = $2
         FOR UPDATE`,
        [skuId, fromLocationId]
      );

      const sourceQty = sourceStock.rowCount > 0 ? sourceStock.rows[0].quantity : 0;
      if (sourceQty < quantity) {
        throw badRequest("Insufficient stock in source location");
      }

      await client.query(
        `UPDATE inventory
         SET quantity = quantity - $1,
             updated_at = NOW()
         WHERE sku_id = $2 AND location_id = $3`,
        [quantity, skuId, fromLocationId]
      );
    }

    if (toLocationId) {
      const destinationCheck = await client.query("SELECT id FROM locations WHERE id = $1", [toLocationId]);
      if (destinationCheck.rowCount === 0) {
        throw badRequest("Unknown toLocationId");
      }

      await client.query(
        `INSERT INTO inventory (sku_id, location_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (sku_id, location_id)
         DO UPDATE SET
           quantity = inventory.quantity + EXCLUDED.quantity,
           updated_at = NOW()`,
        [skuId, toLocationId, quantity]
      );
    }

    const movementInsert = await client.query(
      `INSERT INTO movements (
        sku_id,
        from_location_id,
        to_location_id,
        quantity,
        movement_type,
        reference
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        sku_id AS "skuId",
        from_location_id AS "fromLocationId",
        to_location_id AS "toLocationId",
        quantity,
        movement_type AS "movementType",
        reference,
        created_at AS "createdAt"`,
      [skuId, fromLocationId, toLocationId, quantity, movementType, reference]
    );

    await client.query("COMMIT");
    inTransaction = false;

    await publishRealtimeEvent({
      type: "INVENTORY_UPDATED",
      payload: { movementId: movementInsert.rows[0].id, movementType }
    });

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
