/**
 * CORS for the browser apps (F6). Only origins in CORS_ORIGINS get CORS headers;
 * the browser blocks every other origin. Credentials are allowed for the client's
 * session cookie (S6). The POS never calls this server from the browser (F7).
 */
import type { RequestHandler } from "express";

export function cors(allowed: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");
    if (origin && allowed.includes(origin)) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      });
      if (req.method === "OPTIONS") {
        res.set({
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "600",
        });
        return res.status(204).end();
      }
    }
    next();
  };
}
