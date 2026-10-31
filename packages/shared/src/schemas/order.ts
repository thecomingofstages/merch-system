/**
 * POST /orders (S5): an online order. No amounts: the server prices the cart
 * (docs/BACKEND.md "Business rules" 1). The recipient and address are copied onto the
 * order as sent (business rule 9).
 */
import { z } from "zod";
import { CartItem } from "./quote";

const text = z.string().trim().min(1);

export const Address = z.object({
  details: text,
  tambon: text,
  amphoe: text,
  province: text,
  postal_code: z.string().regex(/^\d{5}$/, "must be 5 digits"),
});
export type Address = z.infer<typeof Address>;

export const Recipient = z.object({
  first_name: text,
  last_name: text,
  nickname: text,
  /** Thai mobile number, 10 digits (draft schema `users.phone`). */
  phone: z.string().regex(/^0\d{9}$/, "must be a 10-digit number starting with 0"),
  line_id: z.string().trim().min(1).nullable().default(null),
  email: z.string().trim().toLowerCase().email(),
});
export type Recipient = z.input<typeof Recipient>;

export const CreateOrderRequest = z.object({
  items: z.array(CartItem).min(1),
  recipient: Recipient,
  shipping_address: Address,
  /** The payload read from the slip's QR code. Required: an unreadable slip blocks the order (D5). */
  slip_qr_data: text,
});
export type CreateOrderRequest = z.input<typeof CreateOrderRequest>;

export type CreateOrderResponse = {
  _id: string;
  status: "ORDERED";
  payment_status: "PENDING_CHECK";
  subtotal: number;
  shipping_fee: number;
  total: number;
  created_at: string;
};
