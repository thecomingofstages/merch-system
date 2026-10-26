/**
 * The database connection (shared: ask BE before changing it).
 *
 * Workers keep nothing between requests, so there is no global connection:
 * each request opens one through `withDb` and closes it when done.
 */
import mongoose, { type Connection } from "mongoose";

export async function withDb<T>(uri: string, fn: (db: Connection) => Promise<T>): Promise<T> {
  const db = await mongoose
    .createConnection(uri, { maxPoolSize: 1, serverSelectionTimeoutMS: 5000 })
    .asPromise();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

/** Answers when the database is reachable; throws otherwise. */
export function pingDatabase(uri: string): Promise<void> {
  return withDb(uri, async (db) => {
    await db.db!.admin().ping();
  });
}
