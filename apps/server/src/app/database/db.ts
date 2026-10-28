/**
 * The database connection (shared: ask BE before changing it).
 *
 * Workers keep nothing between requests, so there is no global connection:
 * each request opens one through `withDb` and closes it when done.
 */
import mongoose, { type Connection } from "mongoose";
import { dbConf } from "../config/db.conf";

export async function withDb<T>(uri: string, fn: (db: Connection) => Promise<T>): Promise<T> {
  const db = await mongoose.createConnection(uri, dbConf).asPromise();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}
