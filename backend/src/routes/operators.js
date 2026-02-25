const express = require("express");
const { getOperatorById, listOperators, updateOperatorStatus } = require("../services/operatorService");

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

router.get("/", async (req, res, next) => {
  try {
    const page = req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page, "page");
    const limit = req.query.limit === undefined ? 50 : parsePositiveInteger(req.query.limit, "limit");
    const operators = await listOperators({
      status: req.query.status,
      page,
      limit
    });

    res.status(200).json(operators);
  } catch (error) {
    next(error);
  }
});

router.get("/:operatorId", async (req, res, next) => {
  try {
    const operator = await getOperatorById(req.params.operatorId);
    if (!operator) {
      const error = new Error("Operator not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json(operator);
  } catch (error) {
    next(error);
  }
});

router.patch("/:operatorId/status", async (req, res, next) => {
  try {
    const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";
    if (!status) {
      const error = new Error("status is required");
      error.statusCode = 400;
      throw error;
    }

    const operator = await updateOperatorStatus(req.params.operatorId, status);
    res.status(200).json(operator);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
