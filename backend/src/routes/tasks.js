const express = require("express");
const { getTaskById, listTasksPaginated, updateTaskStatus } = require("../services/taskService");

const router = express.Router();

const parsePositiveInteger = (value, field) => {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const parseStatusActionPayload = (body) => {
  const version = parsePositiveInteger(body?.version, "version");
  if (version === null) {
    const error = new Error("version is required");
    error.statusCode = 400;
    throw error;
  }

  return {
    version,
    changedByOperatorId: body?.changedByOperatorId ?? null
  };
};

const createStatusActionHandler = (targetStatus) => async (req, res, next) => {
  try {
    const payload = parseStatusActionPayload(req.body);
    const updatedTask = await updateTaskStatus(req.params.taskId, targetStatus, {
      expectedVersion: payload.version,
      changedByOperatorId: payload.changedByOperatorId
    });
    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
};

router.get("/", async (req, res, next) => {
  try {
    const page = req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page, "page");
    const limit = req.query.limit === undefined ? 50 : parsePositiveInteger(req.query.limit, "limit");
    const tasks = await listTasksPaginated({
      status: req.query.status,
      operatorId: req.query.operator_id ?? req.query.operatorId,
      zoneId: req.query.zone ?? req.query.zoneId,
      page,
      limit
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get("/:taskId", async (req, res, next) => {
  try {
    const task = await getTaskById(req.params.taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post("/:taskId/start", createStatusActionHandler("in_progress"));
router.post("/:taskId/complete", createStatusActionHandler("completed"));
router.post("/:taskId/pause", createStatusActionHandler("paused"));
router.post("/:taskId/cancel", createStatusActionHandler("cancelled"));

router.patch("/:taskId/status", async (req, res, next) => {
  try {
    const status = typeof req.body.status === "string" ? req.body.status.trim() : "";
    if (!status) {
      const error = new Error("status is required");
      error.statusCode = 400;
      throw error;
    }

    const payload = parseStatusActionPayload(req.body);

    const updatedTask = await updateTaskStatus(req.params.taskId, status, {
      expectedVersion: payload.version,
      changedByOperatorId: payload.changedByOperatorId
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
