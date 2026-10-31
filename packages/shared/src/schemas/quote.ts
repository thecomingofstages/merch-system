/**
 * POST /quote (S4). The server prices from the database; nothing here carries a
 * price (docs/BACKEND.md "Business rules" 1).
 */
import { z } from "zod";
import { count, objectId } from "./common";

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

export type QuoteLine = {
  product_id: string;
  product_name: string;
  variant_id: string;
  variant_name: string;
  count: number;
  unit_price: number;
};

export type QuoteResponse = {
  lines: QuoteLine[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  promptpay_id: string;
};
