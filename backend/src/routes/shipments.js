const express = require("express");
const requireRole = require("../middlewares/requireRole");
const {
  getShipments,
  getManifest,
  dispatchShipments,
  applyShipmentLabel
} = require("../services/shipmentService");

const router = express.Router();

const managerOnly = requireRole("admin", "warehouse_manager", "supervisor");

// EOD manifest — must be before /:shipmentId to avoid route conflict
router.get("/manifest", managerOnly, async (req, res, next) => {
  try {
    const manifest = await getManifest(req.query.date);
    res.json(manifest);
  } catch (error) {
    next(error);
  }
});

// List shipments with optional ?status=&date=&page=&limit=
router.get("/", async (req, res, next) => {
  try {
    const result = await getShipments({
      status: req.query.status,
      date: req.query.date,
      page: req.query.page,
      limit: req.query.limit
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Bulk dispatch — POST /api/shipments/dispatch { shipmentIds: [...] }
router.post("/dispatch", managerOnly, async (req, res, next) => {
  try {
    const { shipmentIds } = req.body;
    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      const error = new Error("shipmentIds must be a non-empty array");
      error.statusCode = 400;
      throw error;
    }
    const dispatched = await dispatchShipments(shipmentIds);
    res.json({ dispatched: dispatched.length, shipments: dispatched });
  } catch (error) {
    next(error);
  }
});

// Manual label update — PATCH /api/shipments/:id/label
// Used for testing or when carrier label arrives outside the webhook flow
router.patch("/:shipmentId/label", managerOnly, async (req, res, next) => {
  try {
    const { carrier, trackingNumber, labelUrl } = req.body;
    const shipment = await applyShipmentLabel(req.params.shipmentId, {
      carrier,
      trackingNumber,
      labelUrl
    });
    res.json(shipment);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
