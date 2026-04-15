const express = require("express");
const {
  cancelSalesOrder,
  createSalesOrder,
  getSalesOrderById,
  listActiveAlerts,
  listSalesOrders,
  reevaluatePendingOrders
} = require("../services/salesOrderService");
const { normalizeTaskGenerationEvent } = require("../services/taskGenerationLogic");

const router = express.Router();

// POST /api/sales-orders — create a sales order directly
router.post("/", async (req, res, next) => {
  try {
    const normalizedEvent = normalizeTaskGenerationEvent({
      ...req.body,
      type: "sales_order_ready_for_pick"
    });
    const result = await createSalesOrder(normalizedEvent);
    if (result.skipped) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const result = await listSalesOrders({
      status: req.query.status || null,
      page: req.query.page,
      limit: req.query.limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const result = await listActiveAlerts({
      page: req.query.page,
      limit: req.query.limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/reevaluate", async (_req, res, next) => {
  try {
    const stats = await reevaluatePendingOrders();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get("/:salesOrderId", async (req, res, next) => {
  try {
    const order = await getSalesOrderById(req.params.salesOrderId);
    if (!order) {
      const error = new Error("Sales order not found");
      error.statusCode = 404;
      throw error;
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sales-orders/:salesOrderId — cancel
router.delete("/:salesOrderId", async (req, res, next) => {
  try {
    const result = await cancelSalesOrder(req.params.salesOrderId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
