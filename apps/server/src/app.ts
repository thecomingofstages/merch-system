/**
 * buildApp: the Express app, with no listen() and no database connection.
 * index.ts runs it on Workers; tests run it with a test environment.
 */
import express from "express";
import helmet from "helmet";
import type { Env } from "./env";
import { errorHandler, notFound } from "./errors";
import { cors } from "./middleware/cors";
import { adminAuth } from "./middleware/adminAuth";
import { health } from "./routes/health";

export function buildApp(env: Env) {
  const app = express();
  app.locals.env = env;

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors(env.CORS_ORIGINS));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", health);
  // Every /admin/* route needs ADMIN_ACCESS_TOKEN (F6). Admin routers mount below this line (S2, S7, S8).
  app.use("/admin", adminAuth);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
