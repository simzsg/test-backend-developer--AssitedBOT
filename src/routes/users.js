import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { httpError, asyncWrap } from "../utils/http.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.get(
  "/me",
  asyncWrap(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return httpError(res, 401, "unauthenticated");

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return httpError(res, 404, "not found");
    return res.json({ ok: true, user });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return httpError(res, 400, "invalid id");

    try {
      await prisma.user.delete({ where: { id } });
      res.json({ ok: true });
    } catch {
      return httpError(res, 404, "not found");
    }
  })
);

router.patch(
  "/:id",
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return httpError(res, 400, "invalid id");

    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === "ADMIN";
    if (!isSelf && !isAdmin) return httpError(res, 403, "forbidden");

    const { email, name, password, role, isDisabled } = req.body || {};
    const data = {};

    if (email && isAdmin) data.email = String(email).toLowerCase();
    if (name) data.name = String(name);
    if (typeof isDisabled === "boolean" && isAdmin)
      data.isDisabled = Boolean(isDisabled);
    if (role && isAdmin) data.role = role === "ADMIN" ? "ADMIN" : "MEMBER";
    if (password) data.password = await bcrypt.hash(String(password), 10);

    if (Object.keys(data).length === 0)
      return httpError(res, 400, "no updatable fields");

    try {
      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isDisabled: true,
          createdAt: true,
        },
      });
      res.json({ ok: true, user });
    } catch (e) {
     
      if (e?.code === "P2002")
        return httpError(res, 409, "email already in use");
      return httpError(res, 404, "not found");
    }
  })
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncWrap(async (req, res) => {
    const { email, password, name, role } = req.body || {};
    if (!email || !password || !name)
      return httpError(res, 400, "email, password, name are required");

    const exists = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
    });
    if (exists) return httpError(res, 409, "email already in use");

    const hash = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        password: hash,
        name: String(name),
        role: role === "ADMIN" ? "ADMIN" : "MEMBER",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json({ ok: true, user });
  })
);

router.get(
  "/:id",
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return httpError(res, 400, "invalid id");

    const isSelf = req.user.id === id;
    if (!isSelf && req.user.role !== "ADMIN")
      return httpError(res, 403, "forbidden");

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isDisabled: true,
        createdAt: true,
      },
    });
    if (!user) return httpError(res, 404, "not found");
    res.json({ ok: true, user });
  })
);

router.get(
  "/",
  requireRole("ADMIN"),
  asyncWrap(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Number(req.query.offset) || 0;
    const q = (req.query.q || "").toString().trim();

    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { id: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isDisabled: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ ok: true, total, items, limit: take, offset: skip });
  })
);

export default router;
