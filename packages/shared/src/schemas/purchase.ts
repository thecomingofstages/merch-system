import { z } from "zod";
import { Baht, Email, IsoDateTime, NonNegativeInt, ObjectId, PositiveInt, ShippingAddress, ThaiPhone } from "./common";

export const VerifyMethod = z.enum(["QR", "MANUAL"]);
export type VerifyMethod = z.infer<typeof VerifyMethod>;

export const PaymentStatus = z.enum(["PENDING_CHECK", "VERIFIED", "REJECTED"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const OrderStatus = z.enum(["ORDERED", "SHIPPING", "ARRIVED"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PurchaseLineVariant = z.object({
  variants_id: ObjectId,
  variant_name: z.string(),
  count: PositiveInt,
  unit_price: Baht,
});
export type PurchaseLineVariant = z.infer<typeof PurchaseLineVariant>;

export const PurchaseLine = z.object({
  products_id: ObjectId,
  product_name: z.string(),
  variants: z.array(PurchaseLineVariant),
});
export type PurchaseLine = z.infer<typeof PurchaseLine>;

export const Recipient = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  nickname: z.string().trim(),
  phone: ThaiPhone,
  line_id: z.string().trim().nullable(),
  email: Email,
});
export type Recipient = z.infer<typeof Recipient>;

// Stored purchase document (matches apps/server/src/app/models/purchase.model.ts).
// slip_qr_data is optional (never null) because of the unique partial index on { $type: "string" }.
export const Purchase = z.object({
  _id: ObjectId,
  users: ObjectId.nullable(),
  products: z.array(PurchaseLine),
  original_price: Baht,
  shipping_fee: Baht,
  recipient: Recipient.nullable(),
  shipping_address: ShippingAddress.nullable(),
  slip_qr_data: z.string().min(1).optional(),
  verify_method: VerifyMethod,
  payment_status: PaymentStatus,
  verified_at: IsoDateTime.nullable(),
  pos_id: ObjectId.nullable(),
  // TODO(CEO question 30): which carrier is used for tracking_provider?
  tracking_provider: z.string().nullable(),
  tracking_id: z.string().nullable(),
  status: OrderStatus,
  created_at: IsoDateTime,
});
export type Purchase = z.infer<typeof Purchase>;

// GET /admin/orders?status=&payment_status=&page=
export const AdminOrdersQuery = z.object({
  status: OrderStatus.optional(),
  payment_status: PaymentStatus.optional(),
  page: z.coerce.number().int().positive().optional(),
});
export type AdminOrdersQuery = z.infer<typeof AdminOrdersQuery>;

export const AdminOrdersResponse = z.object({
  orders: z.array(Purchase),
  total: NonNegativeInt,
  page: PositiveInt,
  page_size: PositiveInt,
});
export type AdminOrdersResponse = z.infer<typeof AdminOrdersResponse>;

// GET /admin/orders/count?status=ORDERED
export const AdminOrdersCountQuery = z.object({
  status: OrderStatus.optional(),
  payment_status: PaymentStatus.optional(),
});
export type AdminOrdersCountQuery = z.infer<typeof AdminOrdersCountQuery>;

export const AdminOrdersCountResponse = z.object({
  count: NonNegativeInt,
});
export type AdminOrdersCountResponse = z.infer<typeof AdminOrdersCountResponse>;

// PATCH /admin/orders/:id/payment { payment_status: 'VERIFIED' | 'REJECTED' }
export const VerifyPaymentStatus = z.enum(["VERIFIED", "REJECTED"]);
export type VerifyPaymentStatus = z.infer<typeof VerifyPaymentStatus>;

export const UpdateOrderPaymentRequest = z.object({
  payment_status: VerifyPaymentStatus,
});
export type UpdateOrderPaymentRequest = z.infer<typeof UpdateOrderPaymentRequest>;

// PATCH /admin/orders/:id/tracking { tracking_id }
export const UpdateOrderTrackingRequest = z.object({
  tracking_id: z.string().trim().min(1),
});
export type UpdateOrderTrackingRequest = z.infer<typeof UpdateOrderTrackingRequest>;
