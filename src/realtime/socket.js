import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER;

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use((socket, next) => {
    try {
      const header = socket.handshake.headers?.authorization || "";
      const bearer = socket.handshake.auth?.token || header.split(" ")[1];
      if (!bearer) return next(new Error("unauthorized"));

      const decoded = jwt.verify(bearer, JWT_SECRET, { issuer: JWT_ISSUER });
      socket.user = { id: Number(decoded.sub), role: decoded.role };

      socket.join(`user:${socket.user.id}`);
      if (socket.user.role === "ADMIN") socket.join("role:ADMIN");
      next();
    } catch (e) {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log("a user connected");
    socket.emit("users:hello", { ok: true });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("io not initialized");
  return io;
}

export function notifyUserEvent(type, user) {
  const io = getIO();

  io.to("role:ADMIN").emit("users:event", { type, data: user });

  if (user?.id)
    io.to(`user:${user.id}`).emit("users:event", { type, data: user });
}
