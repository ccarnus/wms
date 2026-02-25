const express = require("express");
const { enqueueOrderEventJob } = require("../queue/taskGenerationQueue");
const { normalizeTaskGenerationEvent } = require("../services/taskGenerationLogic");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const normalizedEvent = normalizeTaskGenerationEvent(req.body);
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
