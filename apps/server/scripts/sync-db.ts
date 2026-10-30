/**
 * Creates the collections and indexes for every model, and drops indexes no longer
 * declared. autoIndex and autoCreate are off (config/db.conf.ts), so run this once per
 * database and after any index change:
 *
 *   npm run db:sync -w apps/server
 *
 * Reads MONGODB_URI from the environment, or from .dev.vars locally. The URI is never
 * printed.
 */
import mongoose from "mongoose";
import { dbConf } from "../src/app/config/db.conf";
import { dbKeysSchema } from "../src/app/config/db.keys";
import { syncAllIndexes } from "../src/app/models";

const parsed = dbKeysSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("MONGODB_URI is missing or invalid (set it, or put it in apps/server/.dev.vars).");
  process.exit(1);
}

const db = await mongoose.createConnection(parsed.data.MONGODB_URI, dbConf).asPromise();
try {
  await syncAllIndexes(db);
  for (const name of Object.keys(db.models)) {
    const indexes = await db.models[name]!.listIndexes();
    console.log(`${name}: ${indexes.map((i) => i.name).join(", ")}`);
  }
  console.log(`Synced database "${db.name}".`);
} finally {
  await db.close();
}
