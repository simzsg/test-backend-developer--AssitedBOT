import WebSocket from "ws";
import { prisma } from "../lib/prisma.js";

const WS_BASE = process.env.BINANCE_WS || "wss://stream.binance.com:9443";
const WATCH = (process.env.WATCH_SYMBOLS || "BTCUSDT")
  .split(",")
  .map((s) => s.trim().toLowerCase());

function streamUrl(symbol) {
  return `${WS_BASE}/ws/${symbol}@ticker`;
}

export function startBinanceWS() {
  const sockets = new Map();

  for (const sym of WATCH) connect(sym);

  function connect(sym) {
    const url = streamUrl(sym);
    let ws;
    let reconnectDelay = 1000;

    const open = () => {
      reconnectDelay = 1000;
      console.log(`[WS] connected ${sym}`);
    };

    const message = async (raw) => {
      try {
        const msg = JSON.parse(raw);

        const symbol = (msg.s || sym).toUpperCase();
        const price = msg.c;
        const bid = msg.b;
        const ask = msg.a;
        const volume = msg.v;
        const eventTime = new Date(msg.E || Date.now());

        const { count } = await prisma.priceSnapshot.updateMany({
          where: { symbol },
          data: { price, bid, ask, volume, eventTime, source: "WS" },
        });

        if (count === 0) {
          await prisma.priceSnapshot.create({
            data: { symbol, price, bid, ask, volume, eventTime, source: "WS" },
          });
        }

        await prisma.currentPrice.upsert({
          where: { symbol },
          update: { price, bid, ask, volume, eventTime },
          create: { symbol, price, bid, ask, volume, eventTime },
        });
      } catch (e) {
        console.error(`[WS] ${sym} parse/save error`, e?.message || e);
      }
    };

    const close = () => {
      console.log(`[WS] closed ${sym}, reconnecting in ${reconnectDelay}ms`);
      setTimeout(() => connect(sym), reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    };

    const error = (err) => {
      console.error(`[WS] error ${sym}`, err?.message || err);
      try {
        ws?.close();
      } catch {}
    };

    ws = new WebSocket(url);
    ws.on("open", open);
    ws.on("message", message);
    ws.on("close", close);
    ws.on("error", error);

    sockets.set(sym, ws);
  }
}
