import { z } from "zod";
import { Email, IsoDateTime, ObjectId, SavedAddress } from "./common";

export const UserRole = z.enum(["user", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserGender = z.enum(["Male", "Female", "LGBTQ+", "Unspecified"]);
export type UserGender = z.infer<typeof UserGender>;

// Matches apps/server/src/app/models/user.model.ts and POC page 4 (no password_hash).
export const User = z.object({
  _id: ObjectId,
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  nickname: z.string().nullable(),
  email: Email,
  phone: z.string().nullable(),
  role: UserRole,
  gender: UserGender.nullable(),
  interests: z.array(z.string()),
  profile_image_url: z.string().nullable(),
  education_level: z.string().nullable(),
  institution: z.string().nullable(),
  line_id: z.string().nullable(),
  address: SavedAddress.nullable(),
  created_at: IsoDateTime,
});
export type User = z.infer<typeof User>;

// Autofill fields returned by GET /me (BACKEND.md "API" & TASKS.md S6).
export const MeResponse = z.object({
  email: Email,
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  nickname: z.string().nullable(),
  phone: z.string().nullable(),
  line_id: z.string().nullable(),
  address: SavedAddress.nullable(),
});
export type MeResponse = z.infer<typeof MeResponse>;
