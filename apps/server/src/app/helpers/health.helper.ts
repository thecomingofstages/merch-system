/** Business logic lives in helpers; controllers only translate HTTP. */
import { withDb } from "../database/db";

/** Answers when the database is reachable; throws otherwise. */
export async function pingDatabase(uri: string): Promise<void> {
  await withDb(uri, async (db) => {
    await db.db!.admin().ping();
  });
}
