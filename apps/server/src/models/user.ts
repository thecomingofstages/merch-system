/**
 * The draft users schema (POC page 4), minus password_hash: merch signs in with
 * Google only. Created on first sign-in (D4); fields merch doesn't collect stay empty.
 */
import { Schema } from "mongoose";
import { addressSchema } from "./address";

export const userSchema = new Schema(
  {
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    nickname: { type: String, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // TODO(enrollment schema): the draft lists gender as an enum without its values.
    gender: { type: String, default: null },
    interests: { type: [String], default: [] },
    profile_image_url: { type: String, default: null },
    education_level: { type: String, default: null },
    institution: { type: String, default: null },
    line_id: { type: String, default: null },
    address: { type: addressSchema, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

userSchema.index({ email: 1 }, { unique: true });
