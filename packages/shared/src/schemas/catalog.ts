/** GET /catalog (S3): what the client shows. Only live, visible_to_online variants. */
import { z } from "zod";
import { baht, objectId } from "./common";

export const CatalogVariant = z.object({
  _id: objectId,
  name: z.string(),
  price: baht,
  image: z.string().nullable(),
  online_stock: baht,
  buy_limit: baht,
  sold_out: z.boolean(),
});
export type CatalogVariant = z.infer<typeof CatalogVariant>;

export const CatalogProduct = z.object({
  _id: objectId,
  name: z.string(),
  description: z.string(),
  image: z.array(z.string()),
  variants: z.array(CatalogVariant),
});
export type CatalogProduct = z.infer<typeof CatalogProduct>;

export const CatalogShop = z.object({
  _id: objectId,
  shop_name: z.string(),
  products: z.array(CatalogProduct),
});
export type CatalogShop = z.infer<typeof CatalogShop>;

export const CatalogResponse = z.object({
  shops: z.array(CatalogShop),
});
export type CatalogResponse = z.infer<typeof CatalogResponse>;
