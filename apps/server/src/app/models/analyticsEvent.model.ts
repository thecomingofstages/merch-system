/**
 * Usage statistics (D21): one document per funnel step. Only from visitors with a recorded yes
 * (analytics_consents). No name, email or order: a random visitor id, a session id, a product.
 * Kept until an admin deletes them from the dashboard.
 */
import { Schema } from "mongoose";

export const analyticsEventSchema = new Schema({
  visitor_id: { type: String, required: true },
  session_id: { type: String, required: true },
  type: { type: String, enum: ["impression", "view", "add_to_cart", "checkout", "purchase"], required: true },
  product_id: { type: Schema.Types.ObjectId, required: true },
  at: { type: Date, default: Date.now, immutable: true },
});

analyticsEventSchema.index({ at: 1 });
analyticsEventSchema.index({ product_id: 1, at: 1 });
