const express = require("express");
const {
  listPurchaseOrders,
  getPurchaseOrderById,
  cancelPurchaseOrder,
  reevaluatePendingPurchaseOrders
} = require("../services/purchaseOrderService");

const router = express.Router();

// GET /api/purchase-orders
router.get("/", async (req, res, next) => {
  try {
    const result = await listPurchaseOrders({
      status: req.query.status || null,
      page: req.query.page,
      limit: req.query.limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/purchase-orders/reevaluate — retry pending_capacity orders
router.post("/reevaluate", async (_req, res, next) => {
  try {
    const stats = await reevaluatePendingPurchaseOrders();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/purchase-orders/:purchaseOrderId
router.get("/:purchaseOrderId", async (req, res, next) => {
  try {
    const order = await getPurchaseOrderById(req.params.purchaseOrderId);
    if (!order) {
      const error = new Error("Purchase order not found");
      error.statusCode = 404;
      throw error;
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/purchase-orders/:purchaseOrderId — cancel
router.delete("/:purchaseOrderId", async (req, res, next) => {
  try {
    const result = await cancelPurchaseOrder(req.params.purchaseOrderId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
