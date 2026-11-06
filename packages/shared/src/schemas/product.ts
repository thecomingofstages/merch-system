/**
 * Products with embedded variants (docs/BACKEND.md "Data model", D1).
 * Stock is not part of a create or edit: it changes only through StockRequest (S2),
 * POS transfers (S8) and orders, so a form can't overwrite a count that moved.
 */
import { z } from "zod";
import { baht, objectId } from "./common";

export const VariantRequest = z.object({
  name: z.string().trim().min(1),
  price: baht,
  image: z.string().url().nullable().default(null),
  /** 0 = no limit. */
  buy_limit: z.number().int().min(0).default(0),
  visible_to_online: z.boolean().default(true),
});
export type VariantRequest = z.input<typeof VariantRequest>;

export const VariantPatch = VariantRequest.partial().refine((v) => Object.keys(v).length > 0, "nothing to change");
export type VariantPatch = z.input<typeof VariantPatch>;

export const ProductRequest = z.object({
  shop_id: objectId,
  name: z.string().trim().min(1),
  description: z.string().default(""),
  image: z.array(z.string().url()).default([]),
  variants: z.array(VariantRequest).default([]),
});
export type ProductRequest = z.input<typeof ProductRequest>;

export const ProductPatch = ProductRequest.omit({ variants: true })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "nothing to change");
export type ProductPatch = z.input<typeof ProductPatch>;

/**
 * POST /admin/products/:id/variants/:vid/stock: adds `amount` to online_stock.
 * Negative removes stock (a miscount, or emptying an item before archiving it);
 * it can't take online_stock below 0.
 */
export const StockRequest = z.object({ amount: z.number().int().refine((n) => n !== 0, "must not be 0") });
export type StockRequest = z.infer<typeof StockRequest>;

export const Variant = z.object({
  _id: objectId,
  name: z.string(),
  price: baht,
  image: z.string().nullable(),
  online_stock: baht,
  buy_limit: baht,
  visible_to_online: z.boolean(),
  archived: z.boolean(),
});
export type Variant = z.infer<typeof Variant>;

export const Product = z.object({
  _id: objectId,
  shop_id: objectId,
  name: z.string(),
  description: z.string(),
  image: z.array(z.string()),
  archived: z.boolean(),
  variants: z.array(Variant),
});
export type Product = z.infer<typeof Product>;
