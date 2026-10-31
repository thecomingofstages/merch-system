import type { Request } from "express";
import type { Connection } from "mongoose";
import { withDb } from "../database/db";
import { models, type Models } from "../models";
import { getConfig } from "./config";

/** Runs `fn` with the models on this request's connection (one per request, see database/db.ts). */
export const withModels = <T>(req: Request, fn: (m: Models, db: Connection) => Promise<T>) =>
  withDb(getConfig(req).MONGODB_URI, (db) => fn(models(db), db));
