const express = require("express");
const { query } = require("../db");
const requireRole = require("../middlewares/requireRole");
const {
  validateSkuPayload,
  validateSkuImportRows
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

const SKU_COLUMNS = {
  description: "description",
  unitOfMeasure: "unit_of_measure",
  category: "category",
  weightKg: "weight_kg",
  dimensionXCm: "dimension_x_cm",
  dimensionYCm: "dimension_y_cm",
  dimensionZCm: "dimension_z_cm",
  pictureUrl: "picture_url",
  barcodes: "barcodes",
  minStockLevel: "min_stock_level",
  maxStockLevel: "max_stock_level",
  isActive: "is_active"
};

const RETURNING_FIELDS = `
  id, sku, description,
  unit_of_measure AS "unitOfMeasure",
  category,
  weight_kg AS "weightKg",
  dimension_x_cm AS "dimensionXCm",
  dimension_y_cm AS "dimensionYCm",
  dimension_z_cm AS "dimensionZCm",
  picture_url AS "pictureUrl",
  barcodes,
  min_stock_level AS "minStockLevel",
  max_stock_level AS "maxStockLevel",
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

const SELECT_FIELDS = `
  s.id,
  s.sku,
  s.description,
  s.unit_of_measure AS "unitOfMeasure",
  s.category,
  s.weight_kg AS "weightKg",
  s.dimension_x_cm AS "dimensionXCm",
  s.dimension_y_cm AS "dimensionYCm",
  s.dimension_z_cm AS "dimensionZCm",
  s.picture_url AS "pictureUrl",
  s.barcodes,
  s.min_stock_level AS "minStockLevel",
  s.max_stock_level AS "maxStockLevel",
  s.is_active AS "isActive",
  s.created_at AS "createdAt",
  s.updated_at AS "updatedAt",
  COALESCE(SUM(i.quantity), 0)::int AS "totalQuantity",
  (s.min_stock_level IS NOT NULL AND COALESCE(SUM(i.quantity), 0) < s.min_stock_level) AS "lowStock"`;

// GET /api/skus — list SKUs with aggregated inventory and low-stock flag.
// Filters: ?search= (sku/description), ?category=, ?active=true|false
router.get("/", async (req, res, next) => {
  try {
    const { search, category, active } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(s.sku ILIKE $${idx} OR s.description ILIKE $${idx})`);
      params.push(`%${String(search).trim()}%`);
      idx++;
    }
    if (category) {
      conditions.push(`s.category = $${idx++}`);
      params.push(String(category).trim());
    }
    if (active === "true" || active === "false") {
      conditions.push(`s.is_active = $${idx++}`);
      params.push(active === "true");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT ${SELECT_FIELDS}
      FROM skus s
      LEFT JOIN inventory i ON i.sku_id = s.id
      ${where}
      GROUP BY s.id
      ORDER BY s.sku`,
      params
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/skus/categories — distinct category list for filters
router.get("/categories", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT category FROM skus WHERE category IS NOT NULL ORDER BY category`
    );
    res.json(rows.map((r) => r.category));
  } catch (error) {
    next(error);
  }
});

// GET /api/skus/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${SELECT_FIELDS}
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
router.post("/", configWrite, async (req, res, next) => {
  try {
    const fields = validateSkuPayload(req.body);

    const { rows } = await query(
      `INSERT INTO skus (sku, description, unit_of_measure, category, weight_kg,
                         dimension_x_cm, dimension_y_cm, dimension_z_cm, picture_url, barcodes,
                         min_stock_level, max_stock_level, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${RETURNING_FIELDS}`,
      [
        fields.sku,
        fields.description ?? null,
        fields.unitOfMeasure,
        fields.category ?? null,
        fields.weightKg ?? null,
        fields.dimensionXCm ?? null,
        fields.dimensionYCm ?? null,
        fields.dimensionZCm ?? null,
        fields.pictureUrl ?? null,
        fields.barcodes ?? null,
        fields.minStockLevel ?? null,
        fields.maxStockLevel ?? null,
        fields.isActive ?? true
      ]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(badRequest("A SKU with this code already exists"));
    }
    next(error);
  }
});

// POST /api/skus/import — bulk upsert by SKU code (full-row replace).
// Body: { skus: [{ sku, description, ... }, ...] }
router.post("/import", configWrite, async (req, res, next) => {
  try {
    const { valid, errors } = validateSkuImportRows(req.body?.skus);

    let created = 0;
    let updated = 0;

    for (const { row, index } of valid) {
      try {
        const { rows } = await query(
          `INSERT INTO skus (sku, description, unit_of_measure, category, weight_kg,
                             dimension_x_cm, dimension_y_cm, dimension_z_cm, picture_url, barcodes,
                             min_stock_level, max_stock_level, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (sku) DO UPDATE SET
             description = EXCLUDED.description,
             unit_of_measure = EXCLUDED.unit_of_measure,
             category = EXCLUDED.category,
             weight_kg = EXCLUDED.weight_kg,
             dimension_x_cm = EXCLUDED.dimension_x_cm,
             dimension_y_cm = EXCLUDED.dimension_y_cm,
             dimension_z_cm = EXCLUDED.dimension_z_cm,
             picture_url = EXCLUDED.picture_url,
             barcodes = EXCLUDED.barcodes,
             min_stock_level = EXCLUDED.min_stock_level,
             max_stock_level = EXCLUDED.max_stock_level,
             is_active = EXCLUDED.is_active
           RETURNING (xmax = 0) AS inserted`,
          [
            row.sku,
            row.description ?? null,
            row.unitOfMeasure,
            row.category ?? null,
            row.weightKg ?? null,
            row.dimensionXCm ?? null,
            row.dimensionYCm ?? null,
            row.dimensionZCm ?? null,
            row.pictureUrl ?? null,
            row.barcodes ?? null,
            row.minStockLevel ?? null,
            row.maxStockLevel ?? null,
            row.isActive ?? true
          ]
        );
        if (rows[0].inserted) created++;
        else updated++;
      } catch (error) {
        errors.push({ index, sku: row.sku, message: error.message });
      }
    }

    res.status(errors.length > 0 && created + updated === 0 ? 400 : 200).json({
      created,
      updated,
      errors
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/skus/:id — partial update (sku code itself is immutable)
router.put("/:id", configWrite, async (req, res, next) => {
  try {
    const fields = validateSkuPayload(req.body, { partial: true });

    const existing = await query(
      "SELECT id, min_stock_level, max_stock_level FROM skus WHERE id = $1",
      [req.params.id]
    );
    if (existing.rowCount === 0) throw notFound("SKU not found");

    // Cross-check thresholds against stored values when only one side changes.
    const newMin = fields.minStockLevel !== undefined ? fields.minStockLevel : existing.rows[0].min_stock_level;
    const newMax = fields.maxStockLevel !== undefined ? fields.maxStockLevel : existing.rows[0].max_stock_level;
    if (newMin != null && newMax != null && newMin > newMax) {
      throw badRequest("minStockLevel cannot be greater than maxStockLevel");
    }

    const setClauses = [];
    const params = [req.params.id];
    let idx = 2;
    for (const [field, value] of Object.entries(fields)) {
      setClauses.push(`${SKU_COLUMNS[field]} = $${idx++}`);
      params.push(value);
    }

    const { rows } = await query(
      `UPDATE skus SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING ${RETURNING_FIELDS}`,
      params
    );
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/skus/:id
router.delete("/:id", configWrite, async (req, res, next) => {
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
