const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const healthRoutes = require("./routes/health");
const wmsRoutes = require("./routes/wms");
const tasksRoutes = require("./routes/tasks");
const orderEventsRoutes = require("./routes/orderEvents");
const operatorsRoutes = require("./routes/operators");
const laborRoutes = require("./routes/labor");
const notFoundHandler = require("./middlewares/notFoundHandler");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    message: "WMS API is running",
    endpoints: [
      "/api/health",
      "/api/warehouses",
      "/api/locations",
      "/api/products",
      "/api/inventory",
      "/api/movements",
      "/api/order-events",
      "/api/operators",
      "/api/operators/:operatorId",
      "/api/operators/:operatorId/status",
      "/api/tasks",
      "/api/tasks/:taskId",
      "/api/tasks/:taskId/start",
      "/api/tasks/:taskId/complete",
      "/api/tasks/:taskId/pause",
      "/api/tasks/:taskId/cancel",
      "/api/labor/overview",
      "/api/labor/operator-performance",
      "/api/labor/zone-workload"
    ]
  });
});

app.use("/api/health", healthRoutes);
app.use("/api", wmsRoutes);
app.use("/api/order-events", orderEventsRoutes);
app.use("/api/operators", operatorsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/labor", laborRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
