const express = require("express");
const {
  getSalesOrderById,
  listActiveAlerts,
  listSalesOrders,
  reevaluatePendingOrders
} = require("../services/salesOrderService");

const router = express.Router();

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

module.exports = router;
