/** Controllers stay thin: read the request, call a helper, send the answer. */
import type { RequestHandler } from "express";
import { pingDatabase } from "../helpers/health.helper";
import { ApiError } from "../utils/ApiError";
import { getConfig } from "../utils/config";

export const HealthController = {
  /** GET /health: 200 when the database answers, 503 when it doesn't. The URI is never logged or sent. */
  check: (async (req, res) => {
    try {
      await pingDatabase(getConfig(req).MONGODB_URI);
    } catch (err) {
      console.error("Health check: database unreachable", { name: (err as Error)?.name });
      throw ApiError.unavailable("Database unavailable");
    }
    res.json({ status: "ok", db: "ok" });
  }) satisfies RequestHandler,
};
