const { Server } = require("socket.io");
const socketAuthMiddleware = require("./socketAuthMiddleware");
const { MANAGER_ROOM, getOperatorRoomName } = require("./rooms");
const { subscribeRealtimeEvents, closeRealtimeEventBus } = require("./eventBus");

let io = null;
let unsubscribe = null;

const resolveOperatorIdFromPayload = (payload) =>
  payload?.operatorId || payload?.operator_id || payload?.assignedOperatorId || null;

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

  if (io) {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
    io = null;
  }
};

module.exports = {
  closeSocketServer,
  initializeSocketServer
};
