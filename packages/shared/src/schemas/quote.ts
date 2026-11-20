/**
 * POST /quote (S4). The server prices from the database; nothing here carries a
 * price (docs/BACKEND.md "Business rules" 1).
 */
import { z } from "zod";
import { baht, count, objectId } from "./common";

export const CartItem = z.object({
  product_id: objectId,
  variant_id: objectId,
  count,
});
export type CartItem = z.infer<typeof CartItem>;

/**
 * One promotion set in the cart (D13). `picks[i]` fills the set's item i: variants of that
 * item, mixed freely, whose counts add up to the item's count.
 */
export const PromotionCartItem = z.object({
  promotion_id: objectId,
  picks: z.array(z.array(z.object({ variant_id: objectId, count })).min(1)).min(1),
});
export type PromotionCartItem = z.infer<typeof PromotionCartItem>;

// A cart may hold only sets, so items can be empty; the server answers VALIDATION when both are.
const items = z.array(CartItem);
const promotions = z.array(PromotionCartItem).optional();

export const QuoteRequest = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("ONLINE"), items, promotions }),
  z.object({ channel: z.literal("POS"), pos_id: objectId, items, promotions }),
]);
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const QuoteLine = z.object({
  product_id: objectId,
  product_name: z.string(),
  variant_id: objectId,
  variant_name: z.string(),
  count,
  unit_price: baht,
});
export type QuoteLine = z.infer<typeof QuoteLine>;

/** A piece of a set: a line without a unit price (the set has one price). */
export const SetPick = QuoteLine.omit({ unit_price: true });
export type SetPick = z.infer<typeof SetPick>;

/** A priced set; `picks[i]` are the pieces chosen for the set's item i. */
export const QuotePromotion = z.object({
  promotion_id: objectId,
  name: z.string(),
  price: baht,
  picks: z.array(z.array(SetPick)),
});
export type QuotePromotion = z.infer<typeof QuotePromotion>;

export const QuoteResponse = z.object({
  lines: z.array(QuoteLine),
  promotions: z.array(QuotePromotion),
  subtotal: baht,
  shipping_fee: baht,
  total: baht,
  promptpay_id: z.string(),
});
export type QuoteResponse = z.infer<typeof QuoteResponse>;
