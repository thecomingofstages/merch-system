import type { RequestHandler } from "express";
import { pingDatabase } from "../db";
import type { Env } from "../env";

/** GET /health: 200 when the database answers, 503 when it doesn't. The URI is never logged or sent. */
export const health: RequestHandler = async (req, res) => {
  const { MONGODB_URI } = req.app.locals.env as Env;
  try {
    await pingDatabase(MONGODB_URI);
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    console.error("Health check: database unreachable", { name: (err as Error)?.name });
    res.status(503).json({ error: { code: "UNAVAILABLE", message: "Database unavailable" } });
  }
};
