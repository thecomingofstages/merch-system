import { PRIVACY_VERSION } from "@merch/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, sessionId, track } from "./analytics";

const store = new Map<string, string>();
const consent = (accepted: boolean) =>
  store.set("merch-analytics-consent", JSON.stringify({ accepted, version: PRIVACY_VERSION, visitor_id: accepted ? "11111111-1111-4111-8111-111111111111" : undefined }));

describe("usage statistics in the shop (D21)", () => {
  const sent = vi.fn();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent(url, JSON.parse(String(init.body)));
      return new Response("{}");
    });
    sent.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends nothing without a recorded yes, or after it's taken back", () => {
    track("view", "64b000000000000000000001");
    flush();
    consent(false);
    track("view", "64b000000000000000000001");
    flush();
    expect(sent).not.toHaveBeenCalled();
    consent(true);
    track("view", "64b000000000000000000001");
    consent(false); // withdrawn before the batch went out
    flush();
    expect(sent).not.toHaveBeenCalled();
  });

  it("sends the visitor, the visit and the steps to the shop's own /api", () => {
    consent(true);
    track("checkout", ["64b000000000000000000001", "64b000000000000000000002"]);
    flush();
    expect(sent).toHaveBeenCalledTimes(1);
    const [url, body] = sent.mock.calls[0]!;
    expect(url).toBe("/api/analytics/events");
    expect(body).toMatchObject({
      visitor_id: "11111111-1111-4111-8111-111111111111",
      events: [
        { type: "checkout", product_id: "64b000000000000000000001" },
        { type: "checkout", product_id: "64b000000000000000000002" },
      ],
    });
    expect(body.session_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps the visit while active, and starts a new one after 30 idle minutes", () => {
    const t = Date.UTC(2026, 10, 21, 10);
    const first = sessionId(t);
    expect(sessionId(t + 29 * 60_000)).toBe(first);
    expect(sessionId(t + 29 * 60_000 + 31 * 60_000)).not.toBe(first);
  });
});
