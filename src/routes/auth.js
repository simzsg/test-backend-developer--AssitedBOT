import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { httpError, asyncWrap } from "../utils/http.js";
import { signJwt, authenticate } from "../middleware/auth.js";
import { notifyUserEvent } from "../realtime/socket.js";

const router = express.Router();

router.post(
  "/register",
  asyncWrap(async (req, res) => {
    const { email, password, name } = req.body || {};
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
        role: "MEMBER",
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.status(201).json({ ok: true, user });
    try { notifyUserEvent("user.created", user); } catch {}
  })
);

router.post(
  "/login",
  asyncWrap(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
      return httpError(res, 400, "email and password are required");

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
    });
    if (!user) return httpError(res, 401, "invalid credentials");

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) return httpError(res, 401, "invalid credentials");
    if (user.isDisabled) return httpError(res, 403, "user disabled");

    const token = signJwt({ sub: String(user.id), role: user.role });

    return res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncWrap(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isDisabled: true,
        createdAt: true,
      },
    });
    if (!me) return httpError(res, 404, "not found");
    res.json({ ok: true, user: me });
  })
);

router.patch(
  "/me",
  authenticate,
  asyncWrap(async (req, res) => {
    const { name, password } = req.body || {};
    const data = {};
    if (name) data.name = String(name);
    if (password) data.password = await bcrypt.hash(String(password), 10);
    if (Object.keys(data).length === 0)
      return httpError(res, 400, "no updatable fields (name or password)");

    const updated = await prisma.user.update({
      where: { id: req.user.id },
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

    res.json({ ok: true, user: updated });
    try { notifyUserEvent("user.updated", updated); } catch {}
  })
);

router.delete(
  "/me",
  authenticate,
  asyncWrap(async (req, res) => {
    const before = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    try {
      await prisma.user.delete({ where: { id: req.user.id } });
      res.json({ ok: true });
      try { notifyUserEvent("user.deleted", before || { id: req.user.id }); } catch {}
    } catch {
      return httpError(res, 404, "not found");
    }
  })
);

export default router;
