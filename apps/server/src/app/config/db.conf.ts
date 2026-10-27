/** Fixed database settings (not secret). The database name comes from MONGODB_URI. */
export const dbConf = {
  /** One request, one connection: no pool to keep warm on Workers. */
  maxPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
} as const;
