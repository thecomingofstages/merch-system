import { describe, expect, it } from "vitest";
import { readEnv } from "../src/env";

describe("readEnv", () => {
  it("splits CORS_ORIGINS", () => {
    const env = readEnv({ MONGODB_URI: "mongodb://x/merch", ADMIN_ACCESS_TOKEN: "a".repeat(32), CORS_ORIGINS: "http://a.test, http://b.test" });
    expect(env.CORS_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  it("names the bad settings without printing their values", () => {
    expect(() => readEnv({ MONGODB_URI: "postgres://secret", ADMIN_ACCESS_TOKEN: "short" })).toThrow(/MONGODB_URI[\s\S]*ADMIN_ACCESS_TOKEN[\s\S]*CORS_ORIGINS/);
    expect(() => readEnv({ MONGODB_URI: "postgres://secret" })).not.toThrow(/secret/);
  });
});
