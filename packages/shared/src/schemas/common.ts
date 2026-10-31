import { z } from "zod";

export const ObjectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a 24-character hex ObjectId");
export type ObjectId = z.infer<typeof ObjectId>;

// Money is always whole baht (int >= 0).
export const Baht = z.number().int().nonnegative();
export type Baht = z.infer<typeof Baht>;

export const NonNegativeInt = z.number().int().nonnegative();
export type NonNegativeInt = z.infer<typeof NonNegativeInt>;

export const PositiveInt = z.number().int().positive();
export type PositiveInt = z.infer<typeof PositiveInt>;

export const IsoDateTime = z.iso.datetime();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

export const Email = z.email().trim().toLowerCase();
export type Email = z.infer<typeof Email>;

export const ThaiPhone = z.string().regex(/^0\d{8,9}$/, "Must be a 9 or 10 digit Thai phone number starting with 0");
export type ThaiPhone = z.infer<typeof ThaiPhone>;

export const PostalCode = z.string().regex(/^\d{5}$/, "Must be a 5-digit Thai postal code");
export type PostalCode = z.infer<typeof PostalCode>;

// Stored address in users.address (address.model.ts defaults each field to null).
export const SavedAddress = z.object({
  details: z.string().nullable(),
  tambon: z.string().nullable(),
  amphoe: z.string().nullable(),
  province: z.string().nullable(),
  postal_code: z.string().nullable(),
});
export type SavedAddress = z.infer<typeof SavedAddress>;

// Complete shipping address required when placing an online order.
export const ShippingAddress = z.object({
  details: z.string().trim().min(1),
  tambon: z.string().trim().min(1),
  amphoe: z.string().trim().min(1),
  province: z.string().trim().min(1),
  postal_code: PostalCode,
});
export type ShippingAddress = z.infer<typeof ShippingAddress>;

// Error codes from BACKEND.md "API" plus UNAVAILABLE and INTERNAL used in apps/server.
export const ErrorCode = z.enum([
  "VALIDATION",
  "UNAUTHORIZED",
  "OUT_OF_STOCK",
  "DUPLICATE_SLIP",
  "NOT_FOUND",
  "IN_USE",
  "NOT_VERIFIED",
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
