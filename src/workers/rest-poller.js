import { prisma } from "../lib/prisma.js";
import { get24hTicker } from "../lib/binance.js";

const WATCH = (process.env.WATCH_SYMBOLS || "BTCUSDT")
  .split(",")
  .map((s) => s.trim().toUpperCase());

export async function pollRestOnce() {
  for (const symbol of WATCH) {
    try {
      const t = await get24hTicker(symbol);

      
      const { count } = await prisma.priceSnapshot.updateMany({
        where: { symbol },
        data: {
          price: t.price,
          bid: t.bid,
          ask: t.ask,
          volume: t.volume,
          eventTime: t.eventTime,
          source: "REST",
        },
      });
      if (count === 0) {
        await prisma.priceSnapshot.create({
          data: {
            symbol,
            price: t.price,
            bid: t.bid,
            ask: t.ask,
            volume: t.volume,
            eventTime: t.eventTime,
            source: "REST",
          },
        });
      }

      await prisma.currentPrice.upsert({
        where: { symbol },
        update: {
          price: t.price,
          bid: t.bid,
          ask: t.ask,
          volume: t.volume,
          eventTime: t.eventTime,
        },
        create: {
          symbol,
          price: t.price,
          bid: t.bid,
          ask: t.ask,
          volume: t.volume,
          eventTime: t.eventTime,
        },
      });
    } catch (e) {
      console.error(`[REST] ${symbol} error`, e?.response?.data || e.message);
    }
  }
}