import { buildApp } from "../src/app";
import type { Env } from "../src/env";

export const testEnv: Env = {
  MONGODB_URI: "mongodb://test.invalid/merch",
  ADMIN_ACCESS_TOKEN: "test-admin-token-test-admin-token-0123",
  CORS_ORIGINS: ["http://client.test", "http://dashboard.test"],
};

/** The real Express app with a test environment. It doesn't connect to a database or listen. */
export const buildTestApp = () => buildApp(testEnv);
