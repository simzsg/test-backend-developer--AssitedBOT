import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { httpError } from "../utils/http.js";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_ISSUER = process.env.JWT_ISSUER || "app";

export function signJwt(payload, opts = {}) {
  const expiresIn = opts.expiresIn || process.env.JWT_EXPIRES || "7d";
  return jwt.sign(payload, JWT_SECRET, { issuer: JWT_ISSUER, expiresIn });
}

export async function authenticate(req, res, next) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || typeof auth !== "string") {
    return httpError(res, 401, "missing authorization header");
  }
  const [scheme, token] = auth.split(" ");
  if (!/^Bearer$/i.test(scheme) || !token) {
    return httpError(res, 401, "invalid authorization scheme");
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER });

    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.sub) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isDisabled: true,
      },
    });
    if (!user) return httpError(res, 401, "user not found");
    if (user.isDisabled) return httpError(res, 403, "user disabled");
    req.user = user;
    next();
  } catch (err) {
    return httpError(res, 403, "invalid token");
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const ok = req.user && roles.includes(req.user.role);
    if (!ok) return httpError(res, 403, "forbidden");
    next();
  };
}
