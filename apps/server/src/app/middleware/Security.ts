/**
 * Security defaults for every response:
 * - helmet's headers, `x-powered-by` off.
 * - CORS for the browser apps (F6): only origins in CORS_ORIGINS get CORS headers, so
 *   the browser blocks every other origin. Credentials are allowed for the client's
 *   session cookie (S6). The POS never calls this server from the browser (F7).
 * - JSON bodies only, size-limited.
 */
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import { appConf } from "../config/app.conf";
import type { Config } from "../config/init";

export function Security(app: Express, config: Config) {
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors(config.CORS_ORIGINS));
  app.use(express.json({ limit: appConf.jsonLimit }));
}

function cors(allowed: string[]): RequestHandler {
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
