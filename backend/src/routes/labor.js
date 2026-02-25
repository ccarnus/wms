const express = require("express");
const {
  getLaborOperatorPerformance,
  getLaborOverview,
  getLaborZoneWorkload
} = require("../services/laborService");

const router = express.Router();

const parsePositiveInteger = (value, fieldName) => {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

router.get("/overview", async (req, res, next) => {
  try {
    const overview = await getLaborOverview({
      date: req.query.date
    });

    res.status(200).json(overview);
  } catch (error) {
    next(error);
  }
});

router.get("/operator-performance", async (req, res, next) => {
  try {
    const page = req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page, "page");
    const limit = req.query.limit === undefined ? 50 : parsePositiveInteger(req.query.limit, "limit");

    const result = await getLaborOperatorPerformance({
      date: req.query.date,
      page,
      limit
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/zone-workload", async (req, res, next) => {
  try {
    const page = req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page, "page");
    const limit = req.query.limit === undefined ? 50 : parsePositiveInteger(req.query.limit, "limit");
    const warehouseId =
      req.query.warehouse_id === undefined
        ? null
        : parsePositiveInteger(req.query.warehouse_id, "warehouse_id");

    const result = await getLaborZoneWorkload({
      warehouseId,
      page,
      limit
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
