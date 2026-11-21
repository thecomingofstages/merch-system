import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });

describe("the shop's /api proxy", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_URL", "https://server.example/"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards the cookie, Origin and body to the server, and every Set-Cookie back to the shop's address", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      Object.assign(seen, { url, init });
      const headers = new Headers({ "Content-Type": "application/json" });
      headers.append("Set-Cookie", "merch_session=abc; Path=/; HttpOnly; Secure; SameSite=Lax");
      headers.append("Set-Cookie", "other=1; Path=/");
      return new Response('{"ok":true}', { status: 201, headers });
    });
    const res = await POST(
      new NextRequest("https://merch.example/api/orders?x=1", {
        method: "POST",
        headers: { cookie: "merch_session=old", origin: "https://merch.example", "content-type": "application/json", authorization: "nope" },
        body: '{"a":1}',
      }),
      ctx("orders"),
    );
    expect(seen.url).toBe("https://server.example/orders?x=1");
    const sent = new Headers(seen.init!.headers);
    expect([sent.get("cookie"), sent.get("origin"), sent.get("content-type"), sent.get("authorization")]).toEqual([
      "merch_session=old",
      "https://merch.example",
      "application/json",
      null, // nothing else goes through
    ]);
    expect(new TextDecoder().decode(seen.init!.body as ArrayBuffer)).toBe('{"a":1}');
    expect(res.status).toBe(201);
    expect(res.headers.getSetCookie()).toEqual(["merch_session=abc; Path=/; HttpOnly; Secure; SameSite=Lax", "other=1; Path=/"]);
  });

  it("goes nowhere but the server: no dot segments", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await GET(new NextRequest("https://merch.example/api/x"), ctx("..", "admin"))).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
