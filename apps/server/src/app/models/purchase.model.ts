/**
 * Online orders and POS sales. Names, prices, recipient and address are copied
 * at order time, so later edits never change a past order.
 */
import { Schema } from "mongoose";
import { addressSchema } from "./address.model";

const lineVariantSchema = new Schema(
  {
    variants_id: { type: Schema.Types.ObjectId, required: true },
    variant_name: { type: String, required: true },
    count: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unit_price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  { _id: false },
);

const lineSchema = new Schema(
  {
    products_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    product_name: { type: String, required: true },
    variants: { type: [lineVariantSchema], required: true },
  },
  { _id: false },
);

const recipientSchema = new Schema(
  {
    first_name: String,
    last_name: String,
    nickname: String,
    phone: String,
    line_id: { type: String, default: null },
    email: String,
  },
  { _id: false },
);

export const purchaseSchema = new Schema(
  {
    users: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = POS
    products: { type: [lineSchema], required: true },
    original_price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    shipping_fee: { type: Number, required: true, min: 0, validate: Number.isInteger },
    recipient: { type: recipientSchema, default: null },
    shipping_address: { type: addressSchema, default: null },
    // No default: a sale without a slip leaves the field out, never null (see the index below).
    slip_qr_data: { type: String },
    verify_method: { type: String, enum: ["QR", "MANUAL"], required: true },
    payment_status: { type: String, enum: ["PENDING_CHECK", "VERIFIED", "REJECTED"], default: "PENDING_CHECK" },
    verified_at: { type: Date, default: null },
    pos_id: { type: Schema.Types.ObjectId, ref: "Pos", default: null },
    tracking_provider: { type: String, default: null },
    tracking_id: { type: String, default: null },
    status: { type: String, enum: ["ORDERED", "SHIPPING", "ARRIVED"], default: "ORDERED" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

// One slip pays one order. Partial, not sparse: a sparse index still indexes an
// explicit null, so the second manual POS sale would collide.
purchaseSchema.index(
  { slip_qr_data: 1 },
  { unique: true, partialFilterExpression: { slip_qr_data: { $type: "string" } } },
);
purchaseSchema.index({ status: 1, created_at: -1 });
purchaseSchema.index({ payment_status: 1, created_at: -1 });
purchaseSchema.index({ pos_id: 1 });
