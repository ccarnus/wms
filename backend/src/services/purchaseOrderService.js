const { query } = require("../db");
const { reevaluatePendingPurchaseOrders } = require("./taskGenerationService");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * List purchase orders with optional status filter and pagination.
 */
const listPurchaseOrders = async ({ status = null, page = 1, limit = 50 } = {}) => {
  const values = [];
  const conditions = [];

  if (status) {
    values.push(status);
    conditions.push(`po.status = $${values.length}::purchase_order_status`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM purchase_orders po ${whereClause}`,
    values
  );
  const total = countResult.rows[0]?.total ?? 0;

  const listValues = [...values, safeLimit, offset];
  const { rows } = await query(
    `SELECT
      po.id,
      po.external_id AS "externalId",
      po.source_document_id AS "sourceDocumentId",
      po.status,
      po.strategy,
      po.received_at AS "receivedAt",
      po.created_at AS "createdAt",
      po.updated_at AS "updatedAt",
      (SELECT COUNT(*)::int FROM purchase_order_lines pol WHERE pol.purchase_order_id = po.id) AS "lineCount"
    FROM purchase_orders po
    ${whereClause}
    ORDER BY po.created_at DESC
    LIMIT $${listValues.length - 1}
    OFFSET $${listValues.length}`,
    listValues
  );

  return {
    items: rows,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) }
  };
};

/**
 * Get a single purchase order by ID with its lines.
 */
const getPurchaseOrderById = async (purchaseOrderId) => {
  if (!UUID_REGEX.test(purchaseOrderId)) {
    throw createHttpError(400, "purchaseOrderId must be a valid UUID");
  }

  const { rows } = await query(
    `SELECT
      po.id,
      po.external_id AS "externalId",
      po.source_document_id AS "sourceDocumentId",
      po.status,
      po.strategy,
      po.received_at AS "receivedAt",
      po.created_at AS "createdAt",
      po.updated_at AS "updatedAt"
    FROM purchase_orders po
    WHERE po.id = $1`,
    [purchaseOrderId]
  );

  if (rows.length === 0) {
    return null;
  }

  const order = rows[0];

  const lineResult = await query(
    `SELECT
      pol.id,
      pol.sku_id AS "skuId",
      s.sku,
      s.description AS "skuDescription",
      pol.quantity,
      pol.destination_location_id AS "destinationLocationId",
      l.code AS "destinationLocationCode",
      pol.status
    FROM purchase_order_lines pol
    INNER JOIN skus s ON s.id = pol.sku_id
    LEFT JOIN locations l ON l.id = pol.destination_location_id
    WHERE pol.purchase_order_id = $1
    ORDER BY pol.created_at ASC`,
    [order.id]
  );

  order.lines = lineResult.rows;

  return order;
};

/**
 * Cancel a purchase order. Only allowed when status is 'received'.
 * Marks the order and all its pending lines as cancelled.
 */
const cancelPurchaseOrder = async (purchaseOrderId) => {
  if (!UUID_REGEX.test(purchaseOrderId)) {
    throw createHttpError(400, "purchaseOrderId must be a valid UUID");
  }

  const existing = await query(
    "SELECT id, status FROM purchase_orders WHERE id = $1",
    [purchaseOrderId]
  );

  if (existing.rowCount === 0) {
    throw createHttpError(404, "Purchase order not found");
  }

  const { status } = existing.rows[0];
  if (status !== "received") {
    throw createHttpError(
      409,
      `Cannot cancel a purchase order with status '${status}'. Only 'received' orders can be cancelled.`
    );
  }

  await query(
    `UPDATE purchase_order_lines
     SET status = 'cancelled'::purchase_order_line_status
     WHERE purchase_order_id = $1 AND status = 'pending'::purchase_order_line_status`,
    [purchaseOrderId]
  );

  const { rows } = await query(
    `UPDATE purchase_orders
     SET status = 'cancelled'::purchase_order_status
     WHERE id = $1
     RETURNING id, status`,
    [purchaseOrderId]
  );

  return rows[0];
};

module.exports = {
  listPurchaseOrders,
  getPurchaseOrderById,
  cancelPurchaseOrder,
  reevaluatePendingPurchaseOrders
};
