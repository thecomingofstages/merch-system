import { z } from "zod";

/** A MongoDB ObjectId as a 24-character hex string. */
export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "must be an id");
export type ObjectId = z.infer<typeof objectId>;

/** Money is whole baht (AGENTS.md "Money"). */
export const baht = z.number().int().min(0);
export type Baht = z.infer<typeof baht>;

/** A count of items: a whole number, at least 1. */
export const count = z.number().int().min(1);
export type Count = z.infer<typeof count>;

/** ISO-8601 date-time string over the wire (zod 3 compatible). */
export const IsoDateTime = z.string().datetime();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** Normalized email string (zod 3 compatible). */
export const Email = z.string().trim().toLowerCase().email();
export type Email = z.infer<typeof Email>;

/** Thai mobile phone number: 10 digits starting with 0 (draft schema `users.phone`). */
export const ThaiPhone = z.string().regex(/^0\d{9}$/, "must be a 10-digit number starting with 0");
export type ThaiPhone = z.infer<typeof ThaiPhone>;

/** 5-digit Thai postal code. */
export const PostalCode = z.string().regex(/^\d{5}$/, "must be 5 digits");
export type PostalCode = z.infer<typeof PostalCode>;

/** Stored address in users.address (address.model.ts defaults each field to null). */
export const SavedAddress = z.object({
  details: z.string().nullable(),
  tambon: z.string().nullable(),
  amphoe: z.string().nullable(),
  province: z.string().nullable(),
  postal_code: z.string().nullable(),
});
export type SavedAddress = z.infer<typeof SavedAddress>;

/** Complete shipping address required when placing an online order. */
export const Address = z.object({
  details: z.string().trim().min(1),
  tambon: z.string().trim().min(1),
  amphoe: z.string().trim().min(1),
  province: z.string().trim().min(1),
  postal_code: PostalCode,
});
export type Address = z.infer<typeof Address>;

export const ShippingAddress = Address;
export type ShippingAddress = Address;

/** Error codes from docs/BACKEND.md "API" and apps/server. */
export const ErrorCode = z.enum([
  "VALIDATION",
  "UNAUTHORIZED",
  "OUT_OF_STOCK",
  "DUPLICATE_SLIP",
  "NOT_FOUND",
  "IN_USE",
  "NOT_VERIFIED",
  "BUY_LIMIT",
  "UNAVAILABLE",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
