/**
 * Session (S6): needs a valid session cookie, else 401. Puts the user id in
 * res.locals.user_id.
 * SameOriginJson: closes CSRF on routes that use the cookie (docs/BACKEND.md "Auth details").
 * A cross-site form can't send JSON without a CORS preflight, and only our origins pass one.
 */
import type { RequestHandler } from "express";
import { appConf } from "../config/app.conf";
import { readSessionToken } from "../helpers/session.helper";
import { ApiError } from "../utils/ApiError";
import { getConfig } from "../utils/config";

function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export const Session: RequestHandler = (req, res, next) => {
  const token = readCookie(req.get("cookie"), appConf.sessionCookie);
  const userId = token && readSessionToken(token, getConfig(req).SESSION_SECRET);
  if (!userId) return next(ApiError.unauthorized("Please sign in"));
  res.locals.user_id = userId;
  next();
};

/** For a cookie route with no body, such as logout. */
export const SameOrigin: RequestHandler = (req, _res, next) => {
  if (!getConfig(req).CORS_ORIGINS.includes(req.get("origin") ?? "")) {
    return next(new ApiError(403, "FORBIDDEN", "Origin not allowed"));
  }
  next();
};

export const SameOriginJson: RequestHandler = (req, res, next) => {
  SameOrigin(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.is("application/json")) return next(new ApiError(415, "VALIDATION", "Send JSON"));
    next();
  });
};
