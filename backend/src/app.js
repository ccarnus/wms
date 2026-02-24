const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const healthRoutes = require("./routes/health");
const wmsRoutes = require("./routes/wms");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    message: "WMS API is running",
    endpoints: ["/api/health", "/api/warehouses", "/api/locations", "/api/products", "/api/inventory", "/api/movements"]
  });
});

app.use("/api/health", healthRoutes);
app.use("/api", wmsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";
  if (statusCode >= 500) {
    console.error("Unhandled API error:", error);
  }
  res.status(statusCode).json({ error: message });
});

module.exports = app;
