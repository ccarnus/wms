const { query } = require("../db");
const { USER_ROLES, hashPassword } = require("./authService");

const USER_ROLE_SET = new Set(USER_ROLES);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USER_PUBLIC_SELECT_SQL = `SELECT
  u.id,
  u.username,
  u.display_name AS "displayName",
  u.role,
  u.operator_id AS "operatorId",
  u.is_active AS "isActive",
  u.must_change_password AS "mustChangePassword",
  u.last_login_at AS "lastLoginAt",
  u.created_at AS "createdAt",
  u.updated_at AS "updatedAt"
FROM users u`;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parsePaginationParams = (page, limit) => {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const safePage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit
  };
};

const listUsers = async ({ page = 1, limit = 50 } = {}) => {
  const pagination = parsePaginationParams(page, limit);

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM users`);
  const total = countResult.rows[0]?.total ?? 0;

  const listResult = await query(
    `${USER_PUBLIC_SELECT_SQL} ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
    [pagination.limit, pagination.offset]
  );

  return {
    items: listResult.rows,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};

const getUserById = async (userId) => {
  if (!userId || !UUID_REGEX.test(userId)) {
    throw createHttpError(400, "userId must be a valid UUID");
  }

  const { rows } = await query(
    `${USER_PUBLIC_SELECT_SQL} WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
};

const createUser = async ({ username, password, displayName, role, operatorId }) => {
  if (!username || typeof username !== "string" || !username.trim()) {
    throw createHttpError(400, "username is required");
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    throw createHttpError(400, "password must be at least 6 characters");
  }
  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    throw createHttpError(400, "displayName is required");
  }
  if (!role || !USER_ROLE_SET.has(role)) {
    throw createHttpError(400, `role must be one of: ${USER_ROLES.join(", ")}`);
  }
  if (operatorId !== null && operatorId !== undefined && !UUID_REGEX.test(operatorId)) {
    throw createHttpError(400, "operatorId must be a valid UUID or null");
  }

  const normalizedUsername = username.trim().toLowerCase();

  const existing = await query(
    `SELECT id FROM users WHERE username = $1`,
    [normalizedUsername]
  );
  if (existing.rowCount > 0) {
    throw createHttpError(409, "Username already exists");
  }

  const passwordHash = await hashPassword(password);

  const { rows } = await query(
    `INSERT INTO users (username, password_hash, display_name, role, operator_id, must_change_password)
     VALUES ($1, $2, $3, $4::user_role, $5, true)
     RETURNING id`,
    [normalizedUsername, passwordHash, displayName.trim(), role, operatorId || null]
  );

  return getUserById(rows[0].id);
};

const assertNotAdmin = async (userId, action) => {
  const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
  if (rows.length === 0) {
    throw createHttpError(404, "User not found");
  }
  if (rows[0].role === "admin") {
    throw createHttpError(403, `Admin users cannot be ${action}`);
  }
};

const updateUser = async (userId, { displayName, role, operatorId, isActive }) => {
  if (!userId || !UUID_REGEX.test(userId)) {
    throw createHttpError(400, "userId must be a valid UUID");
  }

  await assertNotAdmin(userId, "modified");

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (displayName !== undefined) {
    if (typeof displayName !== "string" || !displayName.trim()) {
      throw createHttpError(400, "displayName must be a non-empty string");
    }
    setClauses.push(`display_name = $${paramIndex++}`);
    values.push(displayName.trim());
  }

  if (role !== undefined) {
    if (!USER_ROLE_SET.has(role)) {
      throw createHttpError(400, `role must be one of: ${USER_ROLES.join(", ")}`);
    }
    setClauses.push(`role = $${paramIndex++}::user_role`);
    values.push(role);
  }

  if (operatorId !== undefined) {
    if (operatorId !== null && !UUID_REGEX.test(operatorId)) {
      throw createHttpError(400, "operatorId must be a valid UUID or null");
    }
    setClauses.push(`operator_id = $${paramIndex++}`);
    values.push(operatorId);
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      throw createHttpError(400, "isActive must be a boolean");
    }
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(isActive);
  }

  if (setClauses.length === 0) {
    throw createHttpError(400, "No fields to update");
  }

  values.push(userId);
  const { rowCount } = await query(
    `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
    values
  );

  if (rowCount === 0) {
    throw createHttpError(404, "User not found");
  }

  return getUserById(userId);
};

const resetUserPassword = async (userId, newPassword) => {
  if (!userId || !UUID_REGEX.test(userId)) {
    throw createHttpError(400, "userId must be a valid UUID");
  }

  await assertNotAdmin(userId, "password-reset");

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    throw createHttpError(400, "newPassword must be at least 6 characters");
  }

  const passwordHash = await hashPassword(newPassword);

  const { rowCount } = await query(
    `UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2`,
    [passwordHash, userId]
  );

  if (rowCount === 0) {
    throw createHttpError(404, "User not found");
  }

  return getUserById(userId);
};

const deleteUser = async (userId) => {
  if (!userId || !UUID_REGEX.test(userId)) {
    throw createHttpError(400, "userId must be a valid UUID");
  }

  await assertNotAdmin(userId, "deleted");

  const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [userId]);

  if (rowCount === 0) {
    throw createHttpError(404, "User not found");
  }
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser
};
