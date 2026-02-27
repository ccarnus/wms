const jwt = require("jsonwebtoken");

const createUnauthorizedError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== "string") {
    return null;
  }
  const trimmed = authorizationHeader.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim() || null;
  }
  return null;
};

const requireAuth = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next(createUnauthorizedError("Authorization header with Bearer token is required"));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next(createUnauthorizedError("JWT_SECRET is not configured"));
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      operatorId: payload.operatorId || null
    };
    return next();
  } catch (_error) {
    return next(createUnauthorizedError("Invalid or expired token"));
  }
};

module.exports = requireAuth;
