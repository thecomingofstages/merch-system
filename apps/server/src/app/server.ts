/**
 * buildApp: the Express app, with no listen() and no database connection.
 * index.ts runs it on Workers; tests run it with a test config.
 */
import express from "express";
import type { Config } from "./config/init";
import { ErrorHandler, NotFound } from "./middleware/ErrorHandler";
import { Security } from "./middleware/Security";
import { initRoutes } from "./routes/init";

export function buildApp(config: Config) {
  const app = express();
  app.locals.config = config;

  Security(app, config);
  app.use(initRoutes());

  app.use(NotFound);
  app.use(ErrorHandler);
  return app;
}
