const { Server } = require("socket.io");
const socketAuthMiddleware = require("./socketAuthMiddleware");
const { MANAGER_ROOM, getOperatorRoomName } = require("./rooms");
const { subscribeRealtimeEvents, closeRealtimeEventBus } = require("./eventBus");
const { REALTIME_EVENT_TYPES } = require("./eventTypes");

let io = null;
let unsubscribe = null;

/** Map<userId, Set<socketId>> — tracks all connected sockets per user */
const connectedUsers = new Map();

const resolveOperatorIdFromPayload = (payload) =>
  payload?.operatorId || payload?.operator_id || payload?.assignedOperatorId || null;

const getOnlineUserIds = () => [...connectedUsers.keys()];

const broadcastPresence = () => {
  if (!io) {
    return;
  }
  io.to(MANAGER_ROOM).emit(REALTIME_EVENT_TYPES.USER_PRESENCE_UPDATED, {
    onlineUserIds: getOnlineUserIds()
  });
};

const broadcastUserListUpdated = () => {
  if (!io) {
    return;
  }
  io.to(MANAGER_ROOM).emit(REALTIME_EVENT_TYPES.USER_LIST_UPDATED, {});
};

const broadcastRealtimeEvent = (event) => {
  if (!io) {
    return;
  }

  io.to(MANAGER_ROOM).emit(event.type, event.payload);

  const operatorId = resolveOperatorIdFromPayload(event.payload);
  if (operatorId) {
    io.to(getOperatorRoomName(operatorId)).emit(event.type, event.payload);
  }
};

const initializeSocketServer = async (httpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN || "*",
      methods: ["GET", "POST"]
    }
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const authContext = socket.authContext || {};

    if (authContext.isManager) {
      socket.join(MANAGER_ROOM);
    }

    if (authContext.operatorId) {
      socket.join(getOperatorRoomName(authContext.operatorId));
    }

    const userId = authContext.tokenPayload?.sub || null;
    if (userId) {
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
      }
      connectedUsers.get(userId).add(socket.id);
      broadcastPresence();
    }

    socket.on("disconnect", () => {
      if (userId) {
        const sockets = connectedUsers.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            connectedUsers.delete(userId);
          }
        }
        broadcastPresence();
      }
    });
  });

  unsubscribe = await subscribeRealtimeEvents((event) => {
    try {
      broadcastRealtimeEvent(event);
    } catch (error) {
      console.error("[realtime] failed to broadcast event", error);
    }
  });

  return io;
};

const closeSocketServer = async () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  await closeRealtimeEventBus();

  connectedUsers.clear();

  if (io) {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
    io = null;
  }
};

module.exports = {
  broadcastUserListUpdated,
  closeSocketServer,
  getOnlineUserIds,
  initializeSocketServer
};
