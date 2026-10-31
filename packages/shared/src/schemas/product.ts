import { z } from "zod";
import { Baht, NonNegativeInt, ObjectId } from "./common";

// Embedded variant inside products (decision D1, product.model.ts).
// buy_limit: 0 means no limit.
export const Variant = z.object({
  _id: ObjectId,
  name: z.string().trim().min(1),
  price: Baht,
  image: z.string().nullable(),
  online_stock: NonNegativeInt,
  buy_limit: NonNegativeInt,
  visible_to_online: z.boolean(),
  archived: z.boolean(),
});
export type Variant = z.infer<typeof Variant>;

export const Product = z.object({
  _id: ObjectId,
  shop_id: ObjectId,
  name: z.string().trim().min(1),
  description: z.string(),
  image: z.array(z.string()),
  archived: z.boolean(),
  variants: z.array(Variant),
});
export type Product = z.infer<typeof Product>;

export const CreateVariantInput = z.object({
  name: z.string().trim().min(1),
  price: Baht,
  image: z.string().nullable().optional().default(null),
  online_stock: NonNegativeInt.optional().default(0),
  buy_limit: NonNegativeInt.optional().default(0),
  visible_to_online: z.boolean().optional().default(true),
});
export type CreateVariantInput = z.infer<typeof CreateVariantInput>;

export const CreateVariantRequest = CreateVariantInput;
export type CreateVariantRequest = z.infer<typeof CreateVariantRequest>;

export const UpdateVariantRequest = z.object({
  name: z.string().trim().min(1).optional(),
  price: Baht.optional(),
  image: z.string().nullable().optional(),
  buy_limit: NonNegativeInt.optional(),
  visible_to_online: z.boolean().optional(),
  archived: z.boolean().optional(),
});
export type UpdateVariantRequest = z.infer<typeof UpdateVariantRequest>;

export const CreateProductRequest = z.object({
  shop_id: ObjectId,
  name: z.string().trim().min(1),
  description: z.string().optional().default(""),
  image: z.array(z.string()).optional().default([]),
  variants: z.array(CreateVariantInput).optional().default([]),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequest>;

export const UpdateProductRequest = z.object({
  shop_id: ObjectId.optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  image: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
});
export type UpdateProductRequest = z.infer<typeof UpdateProductRequest>;

// POST /admin/products/:id/variants/:vid/stock { amount }
export const AddStockRequest = z.object({
  amount: z.number().int(),
});
export type AddStockRequest = z.infer<typeof AddStockRequest>;

// GET /catalog: public storefront view (exposes only visible_to_online variants with sold_out; omits archived and visible_to_online).
export const CatalogVariant = z.object({
  _id: ObjectId,
  name: z.string(),
  price: Baht,
  image: z.string().nullable(),
  online_stock: NonNegativeInt,
  buy_limit: NonNegativeInt,
  sold_out: z.boolean(),
});
export type CatalogVariant = z.infer<typeof CatalogVariant>;

export const CatalogProduct = z.object({
  _id: ObjectId,
  shop_id: ObjectId,
  name: z.string(),
  description: z.string(),
  image: z.array(z.string()),
  variants: z.array(CatalogVariant),
});
export type CatalogProduct = z.infer<typeof CatalogProduct>;

export const CatalogShop = z.object({
  _id: ObjectId,
  shop_name: z.string(),
  products: z.array(CatalogProduct),
});
export type CatalogShop = z.infer<typeof CatalogShop>;

export const CatalogResponse = z.object({
  shops: z.array(CatalogShop),
});
export type CatalogResponse = z.infer<typeof CatalogResponse>;
