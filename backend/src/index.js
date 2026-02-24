const app = require("./app");
const { pool } = require("./db");

const PORT = Number(process.env.PORT || 3000);

const start = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL");

    app.listen(PORT, () => {
      console.log(`WMS backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error);
    process.exit(1);
  }
};

start();
