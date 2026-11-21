/**
 * The visitor's answer to the usage-statistics question (D20, PDPA s.19). Kept in localStorage
 * under the policy version it was given for, so a new version asks again. The random visitor id
 * exists only after a yes; a no keeps nothing but the no itself.
 */
import { PRIVACY_VERSION } from "@merch/shared";
import { clientApi } from "./api";

const KEY = "merch-analytics-consent";
const CHANGED = "merch:consent-changed";
type Saved = { accepted: boolean; version: string; visitor_id?: string };

/** The stored answer as its raw string: stable between calls, as useSyncExternalStore needs. */
export function consentSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // private mode, blocked storage: ask again
  }
}

/** Calls back when the answer changes, in this tab or another. */
export function subscribeConsent(callback: () => void): () => void {
  window.addEventListener(CHANGED, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGED, callback);
    window.removeEventListener("storage", callback);
  };
}

/** The answer for the current policy version, or null when there is none to go by. */
export function parseConsent(raw: string | null): Saved | null {
  try {
    const saved = JSON.parse(raw ?? "null") as Saved | null;
    return saved && typeof saved.accepted === "boolean" && saved.version === PRIVACY_VERSION ? saved : null;
  } catch {
    return null; // bad JSON: ask again
  }
}

export const readConsent = () => parseConsent(consentSnapshot());

/** The random visitor id, only while the visitor has said yes; the analytics code checks this first. */
export const analyticsVisitorId = () => {
  const saved = readConsent();
  return saved?.accepted ? (saved.visitor_id ?? null) : null;
};

/** randomUUID needs a secure context (not a LAN dev server); getRandomValues works everywhere. */
function newVisitorId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const save = (saved: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage blocked: the question comes back next time
  }
  window.dispatchEvent(new Event(CHANGED));
};

/**
 * A yes counts only once the server has recorded it (the shop must be able to show it); if that
 * fails this throws and nothing is saved. A no stops tracking here first, then records the
 * withdrawal of the earlier yes, if any, and forgets the id. A first no sends nothing.
 */
export async function setConsent(accepted: boolean): Promise<void> {
  const before = readConsent();
  if (accepted) {
    const visitor_id = before?.visitor_id ?? newVisitorId();
    await clientApi.recordConsent({ visitor_id, accepted: true, version: PRIVACY_VERSION });
    save({ accepted: true, version: PRIVACY_VERSION, visitor_id });
    return;
  }
  save({ accepted: false, version: PRIVACY_VERSION });
  if (before?.accepted && before.visitor_id) {
    await clientApi.recordConsent({ visitor_id: before.visitor_id, accepted: false, version: PRIVACY_VERSION }).catch(() => {
      // shortcut: a failed withdrawal record isn't retried; tracking has already stopped on this device.
    });
  }
}
