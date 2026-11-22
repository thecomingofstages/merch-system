/**
 * Promotion sets (D13): "buy these items, in these amounts, for this price". Items can
 * come from any shop; a buyer mixes the allowed variants of each item freely.
 */
import { z } from "zod";
import { baht, count, objectId } from "./common";

export const PromotionItem = z.object({
  product_id: objectId,
  /** The variants a buyer may pick from for this item. */
  variant_ids: z.array(objectId).min(1),
  /** How many pieces of this item one set holds. */
  count,
});
export type PromotionItem = z.infer<typeof PromotionItem>;

/** POST /admin/promotions and PATCH /admin/promotions/:id (the whole set, as the form sends it). */
export const PromotionRequest = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
  image: z.string().url().nullable().default(null),
  price: baht,
  /** Percent off everything in the cart (sets included) while this set is in it. 0 = none. The best one in the cart wins. */
  discount_percent: z.number().int().min(0).max(100).default(0),
  /** Online shipping is free while this set is in the cart. */
  free_shipping: z.boolean().default(false),
  /** Off hides the set everywhere without deleting it. */
  active: z.boolean().default(true),
  items: z.array(PromotionItem).min(1),
});
export type PromotionRequest = z.input<typeof PromotionRequest>;

export const Promotion = PromotionRequest.extend({
  _id: objectId,
  archived: z.boolean(),
});
export type Promotion = z.infer<typeof Promotion>;
