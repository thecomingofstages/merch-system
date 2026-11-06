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

const items = z.array(CartItem).min(1);

export const QuoteRequest = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("ONLINE"), items }),
  z.object({ channel: z.literal("POS"), pos_id: objectId, items }),
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

export const QuoteResponse = z.object({
  lines: z.array(QuoteLine),
  subtotal: baht,
  shipping_fee: baht,
  total: baht,
  promptpay_id: z.string(),
});
export type QuoteResponse = z.infer<typeof QuoteResponse>;
