const jwt = require("jsonwebtoken");

const createUnauthorizedError = (message) => {
  const error = new Error(message);
  error.data = { code: "UNAUTHORIZED" };
  return error;
};

const extractBearerToken = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim() || null;
  }
  return trimmed;
};

const extractTokenFromSocket = (socket) => {
  const authToken = extractBearerToken(socket.handshake?.auth?.token);
  if (authToken) {
    return authToken;
  }

  const authorizationHeader = extractBearerToken(socket.handshake?.headers?.authorization);
  if (authorizationHeader) {
    return authorizationHeader;
  }

  const queryToken = extractBearerToken(socket.handshake?.query?.token);
  if (queryToken) {
    return queryToken;
  }

  return null;
};

const normalizeRoles = (payload) => {
  const roles = new Set();

  if (typeof payload?.role === "string" && payload.role.trim()) {
    roles.add(payload.role.trim().toLowerCase());
  }

  if (Array.isArray(payload?.roles)) {
    for (const role of payload.roles) {
      if (typeof role === "string" && role.trim()) {
        roles.add(role.trim().toLowerCase());
      }
    }
  }

  if (typeof payload?.scope === "string") {
    const scopes = payload.scope.split(/\s+/).filter(Boolean);
    for (const scope of scopes) {
      roles.add(scope.trim().toLowerCase());
    }
  }

  return [...roles];
};

const socketAuthMiddleware = (socket, next) => {
  const token = extractTokenFromSocket(socket);
  if (!token) {
    return next(createUnauthorizedError("JWT token is required"));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next(createUnauthorizedError("JWT_SECRET is not configured"));
  }

  let payload = null;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (_error) {
    return next(createUnauthorizedError("Invalid or expired JWT token"));
  }

  const roles = normalizeRoles(payload);
  const isManager =
    roles.includes("admin") ||
    roles.includes("warehouse_manager") ||
    roles.includes("supervisor") ||
    roles.includes("manager");
  const operatorId =
    (typeof payload.operatorId === "string" && payload.operatorId.trim()) ||
    (typeof payload.operator_id === "string" && payload.operator_id.trim()) ||
    null;

  if (!isManager && !operatorId) {
    return next(createUnauthorizedError("operatorId claim is required for non-manager sockets"));
  }

  socket.authContext = {
    tokenPayload: payload,
    operatorId,
    roles,
    isManager
  };

  return next();
};

module.exports = socketAuthMiddleware;
