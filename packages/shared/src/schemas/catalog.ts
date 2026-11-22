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

/** An active set and the live variants of each item, with their stock (D13). */
export const CatalogPromotion = z.object({
  _id: objectId,
  name: z.string(),
  description: z.string(),
  image: z.string().nullable(),
  price: baht,
  discount_percent: z.number().int().min(0).max(100),
  free_shipping: z.boolean(),
  /** True when some item can't be filled from the stock left. */
  sold_out: z.boolean(),
  items: z.array(
    z.object({
      product_id: objectId,
      product_name: z.string(),
      count: baht,
      variants: z.array(CatalogVariant.pick({ _id: true, name: true, image: true, online_stock: true })),
    }),
  ),
});
export type CatalogPromotion = z.infer<typeof CatalogPromotion>;

export const CatalogResponse = z.object({
  shops: z.array(CatalogShop),
  promotions: z.array(CatalogPromotion),
  /** Online shipping is free from this subtotal (after discount); null when switched off. */
  free_shipping_over: baht.nullable(),
});
export type CatalogResponse = z.infer<typeof CatalogResponse>;
