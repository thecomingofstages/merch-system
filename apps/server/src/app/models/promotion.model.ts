/** Promotion sets (D13): items from any shop, a buyer mixes each item's allowed variants. */
import { Schema } from "mongoose";

const itemSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variant_ids: { type: [Schema.Types.ObjectId], required: true },
    count: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false },
);

export const promotionSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  image: { type: String, default: null },
  price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  active: { type: Boolean, default: true },
  // Deleting archives: an order may still point at the set.
  archived: { type: Boolean, default: false },
  items: { type: [itemSchema], required: true },
});

// The cascades (catalog.helper.ts) find sets by product and by variant.
promotionSchema.index({ "items.product_id": 1 });
promotionSchema.index({ "items.variant_ids": 1 });
