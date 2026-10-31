/**
 * buildTestApp(): the real Express app with a test config. It does not connect to
 * a database or listen; tests that need data mock the helpers (vi.mock).
 */
import type { Config } from "../../src/app/config/init";
import { buildApp } from "../../src/app/server";

export const testConfig: Config = {
  MONGODB_URI: "mongodb://test.invalid/merch",
  ADMIN_ACCESS_TOKEN: "test-admin-token-test-admin-token-0123",
  CORS_ORIGINS: ["http://client.test", "http://dashboard.test"],
  SHIPPING_FEE: 60,
  PROMPTPAY_ID: "0000000000",
};

export const buildTestApp = () => buildApp(testConfig);
