/**
 * verifyGoogleToken and the session cookie, offline: real signature checks with our own
 * RSA key standing in for Google's published keys.
 */
import { createSign, generateKeyPairSync } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { verifyGoogleToken } from "../src/app/helpers/auth.helper";
import { createSessionToken, readSessionToken } from "../src/app/helpers/session.helper";

const clientId = "test-client-id";
const google = generateKeyPairSync("rsa", { modulusLength: 2048 });
const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

function jwt(claims: object, key = google.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "RS256", kid: "k1", typ: "JWT" })}.${b64({
    iss: "https://accounts.google.com",
    aud: clientId,
    sub: "1",
    iat: now - 10,
    exp: now + 600,
    email: "Buyer@Example.com",
    email_verified: true,
    given_name: "Ann",
    family_name: "Lee",
    ...claims,
  })}`;
  return `${body}.${createSign("RSA-SHA256").update(body).sign(key).toString("base64url")}`;
}

describe("verifyGoogleToken", () => {
  beforeAll(() => {
    vi.spyOn(OAuth2Client.prototype, "getFederatedSignonCertsAsync").mockResolvedValue({
      certs: { k1: google.publicKey.export({ type: "spki", format: "pem" }).toString() },
    } as never);
  });

  it("accepts a valid token and lowercases the email", async () => {
    await expect(verifyGoogleToken(jwt({}), clientId)).resolves.toEqual({ email: "buyer@example.com", given_name: "Ann", family_name: "Lee" });
  });

  it.each([
    ["forged (wrong key)", () => jwt({}, attacker.privateKey)],
    ["expired", () => jwt({ iat: 1000, exp: 2000 })],
    ["for another app", () => jwt({ aud: "someone-else" })],
    ["with an unverified email", () => jwt({ email_verified: false })],
    ["not a token at all", () => "nope"],
  ])("rejects a token that is %s", async (_name, token) => {
    await expect(verifyGoogleToken(token(), clientId)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});

describe("session token", () => {
  const secret = "s".repeat(32);

  it("reads back its user", () => {
    expect(readSessionToken(createSessionToken("u1", secret), secret)).toBe("u1");
  });

  it("rejects a changed payload, another secret, garbage, and an expired token", () => {
    const token = createSessionToken("u1", secret);
    const forged = `${b64({ sub: "admin", exp: Date.now() + 1000 })}.${token.split(".")[1]}`;
    expect(readSessionToken(forged, secret)).toBeNull();
    expect(readSessionToken(token, "x".repeat(32))).toBeNull();
    expect(readSessionToken("garbage", secret)).toBeNull();
    expect(readSessionToken(createSessionToken("u1", secret, 0), secret)).toBeNull();
  });
});
