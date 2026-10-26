/**
 * Guards every /admin/* route (F6): needs `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`,
 * else 401. Used by the dashboard and the POS (D6).
 *
 * Both sides are hashed before comparing, so the comparison takes the same time
 * whatever the token's length or content. The token is never logged.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { Env } from "../env";
import { ApiError } from "../errors";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export const adminAuth: RequestHandler = (req, res, next) => {
  const { ADMIN_ACCESS_TOKEN } = req.app.locals.env as Env;
  const given = /^Bearer (.+)$/.exec(req.get("authorization") ?? "")?.[1] ?? "";
  if (!timingSafeEqual(sha256(given), sha256(ADMIN_ACCESS_TOKEN))) {
    res.set("WWW-Authenticate", 'Bearer realm="admin"');
    return next(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
  }
  next();
};
