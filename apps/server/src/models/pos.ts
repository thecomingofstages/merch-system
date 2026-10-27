import { Schema } from "mongoose";

const posVariantSchema = new Schema(
  {
    variants_id: { type: Schema.Types.ObjectId, required: true },
    pos_stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  },
  { _id: false },
);

const stockLogSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, required: true },
    variant_id: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    direction: { type: String, enum: ["TO_POS", "TO_MAIN"], required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

export const posSchema = new Schema({
  name: { type: String, required: true, trim: true },
  shop_ids: { type: [Schema.Types.ObjectId], ref: "Shop", required: true },
  products: {
    type: [
      new Schema(
        { product_id: { type: Schema.Types.ObjectId, required: true }, variants: { type: [posVariantSchema], default: [] } },
        { _id: false },
      ),
    ],
    default: [],
  },
  stock_log: { type: [stockLogSchema], default: [] },
});
