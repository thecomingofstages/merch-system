/**
 * Products with embedded variants (D1). Stock is deducted with a conditional
 * $inc on one variant through arrayFilters (docs/BACKEND.md "Business rules" 3).
 */
import { Schema } from "mongoose";

const wholeBaht = { validator: Number.isInteger, message: "must be a whole number" };

const variantSchema = new Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0, validate: wholeBaht },
  image: { type: String, default: null },
  online_stock: { type: Number, default: 0, min: 0, validate: wholeBaht },
  buy_limit: { type: Number, default: 0, min: 0, validate: wholeBaht }, // 0 = no limit
  visible_to_online: { type: Boolean, default: true },
  archived: { type: Boolean, default: false },
});

export const productSchema = new Schema({
  shop_id: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  image: { type: [String], default: [] },
  archived: { type: Boolean, default: false },
  variants: { type: [variantSchema], default: [] },
});

productSchema.index({ shop_id: 1 });
