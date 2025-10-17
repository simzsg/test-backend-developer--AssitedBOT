import express from "express";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";
import http from "http";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import { httpError } from "./utils/http.js";
import cryptoRoutes from "./routes/crypto.js"
import { initSocket } from "./realtime/socket.js";

import { schedulePricesJob } from "./queue/prices.queue.js";
import { startPricesWorker } from "./queue/prices.worker.js";
import { startBinanceWS } from "./realtime/binance-ws.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/crypto", cryptoRoutes);

app.use((req, res) => httpError(res, 404, "route not found"));

app.use((err, _req, res, _next) => {
  console.error(err);
  return httpError(res, 500, "internal server error");
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

initSocket(server);

startPricesWorker();
schedulePricesJob();


startBinanceWS();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
