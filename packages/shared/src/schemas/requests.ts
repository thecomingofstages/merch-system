import { z } from "zod";
import { Baht, ObjectId, PositiveInt, ShippingAddress } from "./common";
import { Recipient, VerifyMethod } from "./purchase";

export const SalesChannel = z.enum(["ONLINE", "POS"]);
export type SalesChannel = z.infer<typeof SalesChannel>;

// Cart/order line item sent by client or POS (server merges duplicate lines and computes prices).
export const CartLine = z.object({
  product_id: ObjectId,
  variant_id: ObjectId,
  count: PositiveInt,
});
export type CartLine = z.infer<typeof CartLine>;

// POST /quote: pos_id is required when channel is POS.
export const QuoteRequest = z
  .object({
    channel: SalesChannel,
    pos_id: ObjectId.optional(),
    items: z.array(CartLine).min(1),
  })
  .refine((data) => data.channel !== "POS" || Boolean(data.pos_id), {
    message: "pos_id is required when channel is POS",
    path: ["pos_id"],
  });
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const QuoteResponse = z.object({
  subtotal: Baht,
  shipping_fee: Baht,
  total: Baht,
  promptpay_id: z.string().min(1),
});
export type QuoteResponse = z.infer<typeof QuoteResponse>;

// POST /auth/google { id_token }
export const GoogleAuthRequest = z.object({
  id_token: z.string().min(1),
});
export type GoogleAuthRequest = z.infer<typeof GoogleAuthRequest>;

// GET /address/postcode/:code -> [{ tambon, amphoe, province }]
export const PostcodeLookupItem = z.object({
  tambon: z.string(),
  amphoe: z.string(),
  province: z.string(),
});
export type PostcodeLookupItem = z.infer<typeof PostcodeLookupItem>;

export const PostcodeLookupResponse = z.array(PostcodeLookupItem);
export type PostcodeLookupResponse = z.infer<typeof PostcodeLookupResponse>;

// POST /orders: online order requires recipient, shipping_address, and slip_qr_data (D5). Never includes prices/totals.
export const CreateOrderRequest = z.object({
  items: z.array(CartLine).min(1),
  recipient: Recipient,
  shipping_address: ShippingAddress,
  slip_qr_data: z.string().trim().min(1),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequest>;

// POST /pos/:id/sales: QR requires slip_qr_data; MANUAL must omit slip_qr_data.
export const CreatePosSaleRequest = z
  .object({
    items: z.array(CartLine).min(1),
    verify_method: VerifyMethod,
    slip_qr_data: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) =>
      (data.verify_method === "QR" && typeof data.slip_qr_data === "string" && data.slip_qr_data.length > 0) ||
      (data.verify_method === "MANUAL" && data.slip_qr_data === undefined),
    {
      message: "slip_qr_data is required for QR verification and must be omitted for MANUAL verification",
      path: ["slip_qr_data"],
    },
  );
export type CreatePosSaleRequest = z.infer<typeof CreatePosSaleRequest>;
