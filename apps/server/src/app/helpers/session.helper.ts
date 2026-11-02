/**
 * The buyer's session cookie (S6): `<payload>.<signature>`, signed with SESSION_SECRET.
 * Nothing is kept on the server, since Workers keep nothing between requests. A session
 * can't be revoked one at a time: rotating SESSION_SECRET ends them all.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { appConf } from "../config/app.conf";

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest();

export function createSessionToken(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: now + appConf.sessionMaxAgeSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

/** The user id, or null when the token is forged, malformed or expired. */
export function readSessionToken(token: string, secret: string, now = Date.now()): string | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const given = Buffer.from(signature, "base64url");
  const expected = sign(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof sub === "string" && typeof exp === "number" && exp > now ? sub : null;
  } catch {
    return null;
  }
}
