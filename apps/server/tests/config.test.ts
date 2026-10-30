import { describe, expect, it } from "vitest";
import { initConfig } from "../src/app/config/init";

const good = {
  MONGODB_URI: "mongodb://x/merch",
  ADMIN_ACCESS_TOKEN: "a".repeat(32),
  CORS_ORIGINS: "http://a.test",
  SHIPPING_FEE: "60",
  PROMPTPAY_ID: "0000000000",
};

describe("initConfig", () => {
  it("splits CORS_ORIGINS", () => {
    const env = initConfig({ ...good, CORS_ORIGINS: "http://a.test, http://b.test" });
    expect(env.CORS_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  it("reads SHIPPING_FEE as whole baht, and rejects an empty or fractional one", () => {
    expect(initConfig(good).SHIPPING_FEE).toBe(60);
    for (const SHIPPING_FEE of ["", "60.5", "-1"]) expect(() => initConfig({ ...good, SHIPPING_FEE })).toThrow("SHIPPING_FEE");
  });

  it("names the bad settings without printing their values", () => {
    const bad = () => initConfig({ MONGODB_URI: "postgres://secret", ADMIN_ACCESS_TOKEN: "short" });
    for (const name of ["MONGODB_URI", "ADMIN_ACCESS_TOKEN", "CORS_ORIGINS", "SHIPPING_FEE", "PROMPTPAY_ID"]) expect(bad).toThrow(name);
    expect(() => initConfig({ MONGODB_URI: "postgres://secret" })).not.toThrow(/secret/);
  });
});
