/** Google sign-in and the buyer's saved details (S6, D4). */
import type { MeResponse } from "@merch/shared";
import { OAuth2Client } from "google-auth-library";
import type { Types } from "mongoose";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

export type GoogleProfile = { email: string; given_name: string | null; family_name: string | null };

/**
 * Checks the ID token's signature, expiry and audience, and that Google verified the
 * email. 401 for a bad token. Google's keys are fetched first, outside the try: failing to
 * reach them is not the token's fault, so it stays an error (500) and is logged.
 * verifyIdToken reuses the fetched keys.
 */
export async function verifyGoogleToken(idToken: string, clientId: string): Promise<GoogleProfile> {
  const client = new OAuth2Client({ clientId });
  await client.getFederatedSignonCertsAsync();
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized("Invalid Google sign-in");
  }
  if (!payload?.email || !payload.email_verified) throw ApiError.unauthorized("Google has not verified this email");
  return { email: payload.email.toLowerCase(), given_name: payload.given_name ?? null, family_name: payload.family_name ?? null };
}

/** Finds the user by email, or creates one with the email and name from Google (D4). */
export async function signIn(m: Models, profile: GoogleProfile) {
  const user = await m.User.findOneAndUpdate(
    { email: profile.email },
    { $setOnInsert: { email: profile.email, first_name: profile.given_name, last_name: profile.family_name } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return { id: String(user._id), me: toMe(user) };
}

const findUser = (m: Models, id: Types.ObjectId | string) => m.User.findById(id).lean();

export async function getMe(m: Models, userId: Types.ObjectId | string): Promise<MeResponse> {
  const user = await findUser(m, userId);
  if (!user) throw ApiError.unauthorized("Please sign in");
  return toMe(user);
}

function toMe(u: NonNullable<Awaited<ReturnType<typeof findUser>>>): MeResponse {
  return {
    email: u.email,
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    nickname: u.nickname ?? null,
    phone: u.phone ?? null,
    line_id: u.line_id ?? null,
    address: u.address
      ? {
          details: u.address.details ?? null,
          tambon: u.address.tambon ?? null,
          amphoe: u.address.amphoe ?? null,
          province: u.address.province ?? null,
          postal_code: u.address.postal_code ?? null,
        }
      : null,
  };
}
