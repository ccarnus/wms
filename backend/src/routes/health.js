const express = require("express");
const { query } = require("../db");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    await query("SELECT 1");
    res.json({
      status: "ok",
      service: "wms-backend",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
