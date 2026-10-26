import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "./helpers";

vi.mock("../src/db", () => ({ pingDatabase: vi.fn() }));
const { pingDatabase } = await import("../src/db");

describe("GET /health", () => {
  it("answers 200 when the database answers", async () => {
    vi.mocked(pingDatabase).mockResolvedValue();
    const res = await request(buildTestApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "ok" });
  });

  it("answers 503 and keeps the database URI out of the answer and the log", async () => {
    vi.mocked(pingDatabase).mockRejectedValue(new Error("connect ECONNREFUSED mongodb://user:secret-pw@host"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(buildTestApp()).get("/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: "UNAVAILABLE", message: "Database unavailable" } });
    expect(JSON.stringify(res.body) + log.mock.calls.flat().map(String).join(" ")).not.toContain("secret-pw");
    log.mockRestore();
  });
});
