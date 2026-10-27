import { describe, expect, it } from "vitest";
import { initConfig } from "../src/app/config/init";

describe("initConfig", () => {
  it("splits CORS_ORIGINS", () => {
    const env = initConfig({ MONGODB_URI: "mongodb://x/merch", ADMIN_ACCESS_TOKEN: "a".repeat(32), CORS_ORIGINS: "http://a.test, http://b.test" });
    expect(env.CORS_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  it("names the bad settings without printing their values", () => {
    const bad = () => initConfig({ MONGODB_URI: "postgres://secret", ADMIN_ACCESS_TOKEN: "short" });
    for (const name of ["MONGODB_URI", "ADMIN_ACCESS_TOKEN", "CORS_ORIGINS"]) expect(bad).toThrow(name);
    expect(() => initConfig({ MONGODB_URI: "postgres://secret" })).not.toThrow(/secret/);
  });
});
