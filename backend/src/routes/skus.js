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

const MAX_SKU_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PICTURE_URL_LENGTH = 2048;
const MAX_BARCODE_LENGTH = 100;
const MAX_BARCODES = 20;

const validatePositiveNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw badRequest(`${fieldName} must be a non-negative number`);
  }
  return parsed;
};

const validateBarcodes = (barcodes) => {
  if (barcodes === undefined || barcodes === null) return null;
  if (!Array.isArray(barcodes)) {
    throw badRequest("barcodes must be an array of strings");
  }
  if (barcodes.length > MAX_BARCODES) {
    throw badRequest(`barcodes must contain at most ${MAX_BARCODES} entries`);
  }
  for (let i = 0; i < barcodes.length; i++) {
    if (typeof barcodes[i] !== "string" || barcodes[i].trim().length === 0) {
      throw badRequest(`barcodes[${i}] must be a non-empty string`);
    }
    if (barcodes[i].length > MAX_BARCODE_LENGTH) {
      throw badRequest(`barcodes[${i}] must be at most ${MAX_BARCODE_LENGTH} characters`);
    }
  }
  return barcodes.map((b) => b.trim());
};

// GET /api/skus — list all SKUs with aggregated inventory quantity
router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        s.id,
        s.sku,
        s.description,
        s.weight_kg AS "weightKg",
        s.dimension_x_cm AS "dimensionXCm",
        s.dimension_y_cm AS "dimensionYCm",
        s.dimension_z_cm AS "dimensionZCm",
        s.picture_url AS "pictureUrl",
        s.barcodes,
        s.created_at AS "createdAt",
        s.updated_at AS "updatedAt",
        COALESCE(SUM(i.quantity), 0)::int AS "totalQuantity"
      FROM skus s
      LEFT JOIN inventory i ON i.sku_id = s.id
      GROUP BY s.id
      ORDER BY s.sku`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/skus/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
        s.id,
        s.sku,
        s.description,
        s.weight_kg AS "weightKg",
        s.dimension_x_cm AS "dimensionXCm",
        s.dimension_y_cm AS "dimensionYCm",
        s.dimension_z_cm AS "dimensionZCm",
        s.picture_url AS "pictureUrl",
        s.barcodes,
        s.created_at AS "createdAt",
        s.updated_at AS "updatedAt",
        COALESCE(SUM(i.quantity), 0)::int AS "totalQuantity"
      FROM skus s
      LEFT JOIN inventory i ON i.sku_id = s.id
      WHERE s.id = $1
      GROUP BY s.id`,
      [req.params.id]
    );
    if (rows.length === 0) throw notFound("SKU not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/skus
router.post("/", async (req, res, next) => {
  try {
    const { sku, description, weightKg, dimensionXCm, dimensionYCm, dimensionZCm, pictureUrl, barcodes } = req.body;

    if (!sku || typeof sku !== "string" || sku.trim().length === 0) {
      throw badRequest("sku is required");
    }
    const trimmedSku = sku.trim();
    if (trimmedSku.length > MAX_SKU_LENGTH) {
      throw badRequest(`sku must be at most ${MAX_SKU_LENGTH} characters`);
    }

    const trimmedDescription = description ? String(description).trim().slice(0, MAX_DESCRIPTION_LENGTH) : null;
    const parsedWeightKg = validatePositiveNumber(weightKg, "weightKg");
    const parsedDimX = validatePositiveNumber(dimensionXCm, "dimensionXCm");
    const parsedDimY = validatePositiveNumber(dimensionYCm, "dimensionYCm");
    const parsedDimZ = validatePositiveNumber(dimensionZCm, "dimensionZCm");

    let trimmedPictureUrl = null;
    if (pictureUrl && typeof pictureUrl === "string" && pictureUrl.trim().length > 0) {
      trimmedPictureUrl = pictureUrl.trim().slice(0, MAX_PICTURE_URL_LENGTH);
    }

    const validatedBarcodes = validateBarcodes(barcodes);

    const { rows } = await query(
      `INSERT INTO skus (sku, description, weight_kg, dimension_x_cm, dimension_y_cm, dimension_z_cm, picture_url, barcodes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, sku, description,
                 weight_kg AS "weightKg",
                 dimension_x_cm AS "dimensionXCm",
                 dimension_y_cm AS "dimensionYCm",
                 dimension_z_cm AS "dimensionZCm",
                 picture_url AS "pictureUrl",
                 barcodes,
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [trimmedSku, trimmedDescription, parsedWeightKg, parsedDimX, parsedDimY, parsedDimZ, trimmedPictureUrl, validatedBarcodes]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A SKU with this code already exists"));
    }
    next(error);
  }
});

// PUT /api/skus/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { description, weightKg, dimensionXCm, dimensionYCm, dimensionZCm, pictureUrl, barcodes } = req.body;

    const existing = await query("SELECT id FROM skus WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) throw notFound("SKU not found");

    const setClauses = [];
    const params = [req.params.id];
    let idx = 2;

    if (description !== undefined) {
      const val = description === null ? null : String(description).trim().slice(0, MAX_DESCRIPTION_LENGTH);
      setClauses.push(`description = $${idx++}`);
      params.push(val);
    }
    if (weightKg !== undefined) {
      setClauses.push(`weight_kg = $${idx++}`);
      params.push(validatePositiveNumber(weightKg, "weightKg"));
    }
    if (dimensionXCm !== undefined) {
      setClauses.push(`dimension_x_cm = $${idx++}`);
      params.push(validatePositiveNumber(dimensionXCm, "dimensionXCm"));
    }
    if (dimensionYCm !== undefined) {
      setClauses.push(`dimension_y_cm = $${idx++}`);
      params.push(validatePositiveNumber(dimensionYCm, "dimensionYCm"));
    }
    if (dimensionZCm !== undefined) {
      setClauses.push(`dimension_z_cm = $${idx++}`);
      params.push(validatePositiveNumber(dimensionZCm, "dimensionZCm"));
    }
    if (pictureUrl !== undefined) {
      const val = pictureUrl === null ? null : String(pictureUrl).trim().slice(0, MAX_PICTURE_URL_LENGTH);
      setClauses.push(`picture_url = $${idx++}`);
      params.push(val);
    }
    if (barcodes !== undefined) {
      setClauses.push(`barcodes = $${idx++}`);
      params.push(validateBarcodes(barcodes));
    }

    if (setClauses.length === 0) {
      throw badRequest("At least one field to update is required");
    }

    const { rows } = await query(
      `UPDATE skus SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING id, sku, description,
                 weight_kg AS "weightKg",
                 dimension_x_cm AS "dimensionXCm",
                 dimension_y_cm AS "dimensionYCm",
                 dimension_z_cm AS "dimensionZCm",
                 picture_url AS "pictureUrl",
                 barcodes,
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      params
    );
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/skus/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const invCheck = await query("SELECT id FROM inventory WHERE sku_id = $1 AND quantity > 0 LIMIT 1", [req.params.id]);
    if (invCheck.rowCount > 0) {
      throw badRequest("Cannot delete SKU with inventory. Move or adjust stock first.");
    }

    const movCheck = await query("SELECT id FROM movements WHERE sku_id = $1 LIMIT 1", [req.params.id]);
    if (movCheck.rowCount > 0) {
      throw badRequest("Cannot delete SKU with movement history. It is referenced by past movements.");
    }

    const taskCheck = await query(
      `SELECT id FROM task_lines
       WHERE sku_id = $1
         AND status NOT IN ('completed', 'cancelled', 'failed')
       LIMIT 1`,
      [req.params.id]
    );
    if (taskCheck.rowCount > 0) {
      throw badRequest("Cannot delete SKU referenced by active task lines");
    }

    const { rowCount } = await query("DELETE FROM skus WHERE id = $1", [req.params.id]);
    if (rowCount === 0) throw notFound("SKU not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
