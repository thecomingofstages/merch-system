/** Fixed database settings (not secret). The database name comes from MONGODB_URI. */
export const dbConf = {
  /** One request, one connection: no pool to keep warm on Workers. */
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  /**
   * Collections and indexes are created once per database by `npm run db:sync -w apps/server`
   * (scripts/sync-db.ts), not by Mongoose on every new connection, which here means
   * on every request.
   */
  autoIndex: false,
  autoCreate: false,
} as const;
