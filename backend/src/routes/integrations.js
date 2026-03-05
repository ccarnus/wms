const express = require("express");
const {
  getConnectorTypes, listIntegrations, getIntegrationById, getIntegrationByInboundKey,
  createIntegration, updateIntegration, deleteIntegration, toggleIntegration,
  testIntegration, getEventLog, logIntegrationEvent
} = require("../services/integrationService");
const { getConnector } = require("../integrations");

const router = express.Router();

router.get("/connector-types", async (_req, res, next) => {
  try {
    res.json(getConnectorTypes());
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const integrations = await listIntegrations();
    res.json(integrations);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const integration = await getIntegrationById(req.params.id);
    res.json(integration);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const integration = await createIntegration({
      ...req.body,
      createdBy: req.user?.userId || null
    });
    res.status(201).json(integration);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const updated = await updateIntegration(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await deleteIntegration(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/toggle", async (req, res, next) => {
  try {
    const updated = await toggleIntegration(req.params.id, req.body.isEnabled);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/test", async (req, res, next) => {
  try {
    const result = await testIntegration(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/events", async (req, res, next) => {
  try {
    const result = await getEventLog(req.params.id, {
      page: req.query.page,
      limit: req.query.limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
