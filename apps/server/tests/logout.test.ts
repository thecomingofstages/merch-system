import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp, testConfig } from "./helpers/app";

describe("POST /auth/logout", () => {
  it("clears the session cookie with the attributes it was set with", async () => {
    const res = await request(buildTestApp()).post("/auth/logout").set("Origin", testConfig.CORS_ORIGINS[0]!);
    expect(res.status).toBe(204);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^merch_session=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("refuses a foreign origin, so another site can't sign a buyer out", async () => {
    const res = await request(buildTestApp()).post("/auth/logout").set("Origin", "http://evil.test");
    expect(res.status).toBe(403);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});
