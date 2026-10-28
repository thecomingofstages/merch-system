import { Schema } from "mongoose";

export const shopSchema = new Schema({
  shop_name: { type: String, required: true, trim: true },
  // Archived instead of deleted, so products and orders never point at nothing.
  archived: { type: Boolean, default: false },
});
