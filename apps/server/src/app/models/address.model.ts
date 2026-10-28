import { Schema } from "mongoose";

/** Thai address, used by users.address and purchases.shipping_address (docs/BACKEND.md "Data model"). */
export const addressSchema = new Schema(
  {
    details: { type: String, default: null },
    tambon: { type: String, default: null },
    amphoe: { type: String, default: null },
    province: { type: String, default: null },
    postal_code: { type: String, default: null },
  },
  { _id: false },
);
