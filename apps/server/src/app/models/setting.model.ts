/** Shop-wide settings: one document, _id "shop" (see settings.helper.ts). */
import { Schema } from "mongoose";

export const settingSchema = new Schema({
  _id: { type: String, required: true },
  free_shipping_enabled: { type: Boolean, default: false },
  free_shipping_min: { type: Number, default: 1, min: 1, validate: Number.isInteger },
});
