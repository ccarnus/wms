const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = "8h";

const USER_ROLES = Object.freeze([
  "admin",
  "warehouse_manager",
  "supervisor",
  "operator",
  "viewer"
]);

const USER_SELECT_SQL = `SELECT
  u.id,
  u.username,
  u.password_hash AS "passwordHash",
  u.display_name AS "displayName",
  u.role,
  u.operator_id AS "operatorId",
  u.is_active AS "isActive",
  u.last_login_at AS "lastLoginAt",
  u.created_at AS "createdAt",
  u.updated_at AS "updatedAt"
FROM users u`;

const USER_PUBLIC_SELECT_SQL = `SELECT
  u.id,
  u.username,
  u.display_name AS "displayName",
  u.role,
  u.operator_id AS "operatorId",
  u.is_active AS "isActive",
  u.last_login_at AS "lastLoginAt",
  u.created_at AS "createdAt",
  u.updated_at AS "updatedAt"
FROM users u`;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw createHttpError(500, "JWT_SECRET is not configured");
  }
  return secret;
};

const login = async (username, password) => {
  if (!username || typeof username !== "string") {
    throw createHttpError(400, "username is required");
  }
  if (!password || typeof password !== "string") {
    throw createHttpError(400, "password is required");
  }

  const { rows } = await query(
    `${USER_SELECT_SQL} WHERE u.username = $1`,
    [username.trim().toLowerCase()]
  );

  const user = rows[0] || null;

  if (!user) {
    throw createHttpError(401, "Invalid username or password");
  }

  if (!user.isActive) {
    throw createHttpError(403, "Account is deactivated");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw createHttpError(401, "Invalid username or password");
  }

  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

  const tokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    operatorId: user.operatorId || null
  };

  const token = jwt.sign(tokenPayload, getJwtSecret(), {
    expiresIn: JWT_EXPIRY,
    subject: user.id
  });

  const { passwordHash: _omit, ...publicUser } = user;

  return { user: publicUser, token };
};

const getUserById = async (userId) => {
  const { rows } = await query(
    `${USER_PUBLIC_SELECT_SQL} WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
};

const hashPassword = async (plaintext) => {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
};

module.exports = {
  USER_ROLES,
  BCRYPT_ROUNDS,
  JWT_EXPIRY,
  login,
  getUserById,
  hashPassword
};
