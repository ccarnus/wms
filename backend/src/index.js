const app = require("./app");
const { pool } = require("./db");
const { closeTaskGenerationQueue } = require("./queue/taskGenerationQueue");

const PORT = Number(process.env.PORT || 3000);
let server = null;

const shutdown = async () => {
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    await closeTaskGenerationQueue();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Graceful shutdown failed:", error);
    process.exit(1);
  }
};

const start = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL");

    server = app.listen(PORT, () => {
      console.log(`WMS backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error);
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
