import express from "express";
import { prisma } from "../lib/prisma.js";
import { httpError, asyncWrap } from "../utils/http.js";
import { authenticate } from "../middleware/auth.js";



const router = express.Router();
router.use(authenticate);

router.get("/all", asyncWrap(async (req, res) => {
  const take = Math.min(Number(req.query.limit) || 100, 1000);
  const skip = Number(req.query.offset) || 0;
  const sort = (req.query.sort || "symbol").toString();
  const order = req.query.order === "desc" ? "desc" : "asc";

  const sortableDb = new Set(["symbol", "eventTime"]);
  const orderByField = sortableDb.has(sort) ? sort : "symbol";

  const distinctSymbols = await prisma.priceSnapshot.findMany({
    select: { symbol: true },
    distinct: ["symbol"],
  });
  const total = distinctSymbols.length;

  const groupOrderBy =
    orderByField === "eventTime" ? { _max: { eventTime: order } } : { symbol: order };

  const groups = await prisma.priceSnapshot.groupBy({
    by: ["symbol"],
    _max: { id: true, eventTime: true },
    orderBy: groupOrderBy,
    take,
    skip,
  });

  const ids = groups.map((g) => g._max.id).filter(Boolean);
  const rows = ids.length
    ? await prisma.priceSnapshot.findMany({
        where: { id: { in: ids } },
        select: { id: true, symbol: true, price: true, bid: true, ask: true, volume: true, eventTime: true, source: true },
      })
    : [];

  const byId = new Map(rows.map(r => [r.id, r]));
  const items = ids.map(id => byId.get(id)).filter(Boolean);

  res.set("Cache-Control", "no-store");
  res.json({ ok: true, total, limit: take, offset: skip, sort: orderByField, order, items });
}));


router.get("/currentPrice", asyncWrap(async (req, res) => {
  const raw = (req.query.symbols || "").toString().trim();
  const symbols = raw ? raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) : [];
  const items = symbols.length
    ? await prisma.currentPrice.findMany({ where: { symbol: { in: symbols } }, orderBy: { symbol: "asc" } })
    : await prisma.currentPrice.findMany({ orderBy: { symbol: "asc" } });

  res.set("Cache-Control", "no-store");
  res.json({ ok: true, count: items.length, items });
}));


router.get("/:symbol", asyncWrap(async (req, res) => {
  const symbol = String(req.params.symbol || "").toUpperCase().trim();
  if (!symbol) return httpError(res, 400, "invalid symbol");
  const row = await prisma.currentPrice.findUnique({ where: { symbol } });
  if (!row) return httpError(res, 404, "not found");
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, data: row });
}));

export default router;
