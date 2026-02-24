const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "wms",
  user: process.env.DB_USER || "wms_user",
  password: process.env.DB_PASSWORD || "wms_password",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL idle client error", error);
});

const query = (text, params = []) => pool.query(text, params);

module.exports = { pool, query };
