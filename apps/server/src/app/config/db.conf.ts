/** Fixed database settings (not secret). The database name comes from MONGODB_URI. */
export const dbConf = {
  /** One request, one connection: no pool to keep warm on Workers. */
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  /**
   * Indexes are built once per database with syncAllIndexes (models/index.ts), not by
   * Mongoose on every new connection, which here means on every request.
   */
  autoIndex: false,
} as const;
