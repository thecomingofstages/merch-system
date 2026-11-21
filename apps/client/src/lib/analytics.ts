/**
 * Usage statistics (D21): the per-product funnel, sent only after a recorded yes (D20). No name,
 * email or order is sent: the random visitor id, the visit's id, a step and a product.
 */
import type { AnalyticsStep } from "@merch/shared";
import { isFixturesMode } from "./api";
import { analyticsVisitorId, newVisitorId } from "./consent";

const SESSION_KEY = "merch-analytics-session";
const IDLE_MS = 30 * 60 * 1000; // a visit ends after 30 minutes without activity
const SEND_AFTER_MS = 3000;
const BATCH = 50; // the server's limit per request

/** The visit's id: kept while the visitor is active, a new one after 30 idle minutes. */
export function sessionId(now = Date.now()): string {
  let saved: { id?: string; last?: number } = {};
  try {
    saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "{}");
  } catch {
    // blocked storage: every call is a new visit, which only overcounts sessions
  }
  const id = saved.id && saved.last && now - saved.last < IDLE_MS ? saved.id : newVisitorId();
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
  } catch {
    // see above
  }
  return id;
}

let queue: { type: AnalyticsStep; product_id: string }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** Notes a step for one or more products; nothing at all without a recorded yes. */
export function track(type: AnalyticsStep, productIds: string | string[]) {
  if (isFixturesMode() || !analyticsVisitorId()) return;
  for (const product_id of [productIds].flat()) queue.push({ type, product_id });
  sessionId(); // activity keeps the visit going
  timer ??= setTimeout(flush, SEND_AFTER_MS);
}

/** Sends what's waiting. keepalive lets it finish while the page closes. */
export function flush() {
  clearTimeout(timer);
  timer = undefined;
  const visitor_id = analyticsVisitorId();
  const events = queue;
  queue = [];
  if (!visitor_id || events.length === 0) return; // a withdrawn yes drops what was waiting
  const session_id = sessionId();
  for (let i = 0; i < events.length; i += BATCH) {
    void fetch("/api/analytics/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id, session_id, events: events.slice(i, i + BATCH) }),
    }).catch(() => {}); // statistics never get in the buyer's way
  }
}

if (typeof window !== "undefined") window.addEventListener("pagehide", flush);
