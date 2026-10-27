import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp, testConfig } from "./helpers/app";

describe("admin auth (F6)", () => {
  it.each([
    ["no header", undefined],
    ["wrong token", "Bearer wrong-token"],
    ["token without Bearer", testConfig.ADMIN_ACCESS_TOKEN],
  ])("answers 401 with %s", async (_label, header) => {
    const req = request(buildTestApp()).get("/admin/anything");
    const res = await (header ? req.set("Authorization", header) : req);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
  });

  it("lets the right token through (no admin routes yet, so 404)", async () => {
    const res = await request(buildTestApp()).get("/admin/anything").set("Authorization", `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}`);
    expect(res.status).toBe(404);
  });
});

describe("CORS (F6)", () => {
  it("allows an origin in CORS_ORIGINS", async () => {
    const res = await request(buildTestApp()).options("/health").set("Origin", "http://client.test");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://client.test");
  });

  it("sends no CORS headers to any other origin", async () => {
    const res = await request(buildTestApp()).options("/health").set("Origin", "http://evil.test");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
