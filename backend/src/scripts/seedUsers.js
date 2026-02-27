const { pool, query } = require("../db");
const { hashPassword } = require("../services/authService");

const SEED_USERS = [
  {
    username: "admin",
    password: "admin123",
    displayName: "System Administrator",
    role: "admin",
    operatorId: null
  }
];

const seed = async () => {
  for (const user of SEED_USERS) {
    const existing = await query(
      "SELECT id FROM users WHERE username = $1",
      [user.username]
    );

    if (existing.rowCount > 0) {
      console.log(`User "${user.username}" already exists, skipping.`);
      continue;
    }

    const passwordHash = await hashPassword(user.password);
    await query(
      `INSERT INTO users (username, password_hash, display_name, role, operator_id)
       VALUES ($1, $2, $3, $4::user_role, $5)`,
      [user.username, passwordHash, user.displayName, user.role, user.operatorId]
    );

    console.log(`Created user "${user.username}" with role "${user.role}".`);
  }
};

seed()
  .then(() => {
    console.log("User seed complete.");
    return pool.end();
  })
  .catch((error) => {
    console.error("User seed failed:", error);
    process.exit(1);
  });
