const express = require("express");
const { enqueueOrderEventJob } = require("../queue/taskGenerationQueue");
const { normalizeTaskGenerationEvent } = require("../services/taskGenerationLogic");
const { query } = require("../db");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const normalizedEvent = normalizeTaskGenerationEvent(req.body);

    // Validate all SKU IDs exist before enqueuing — gives the caller a synchronous
    // 400 rather than a silent async failure after BullMQ retries exhaust.
    const requestedSkuIds = [...new Set(normalizedEvent.lines.map((l) => l.skuId))];
    const { rows: foundSkus } = await query(
      `SELECT id FROM skus WHERE id = ANY($1::int[])`,
      [requestedSkuIds]
    );
    const foundSkuIds = new Set(foundSkus.map((r) => r.id));
    const unknownSkuIds = requestedSkuIds.filter((id) => !foundSkuIds.has(id));
    if (unknownSkuIds.length > 0) {
      const error = new Error(`Unknown SKU ID(s): ${unknownSkuIds.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }

    const enqueueResult = await enqueueOrderEventJob(normalizedEvent);

    res.status(202).json({
      accepted: true,
      type: normalizedEvent.type,
      sourceDocumentId: normalizedEvent.sourceDocumentId,
      eventKey: enqueueResult.eventKey,
      queueName: enqueueResult.queueName,
      jobId: enqueueResult.jobId
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
