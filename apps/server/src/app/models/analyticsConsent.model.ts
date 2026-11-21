/**
 * The record of each visitor's usage-statistics consent (D20, PDPA s.19: the shop must be able
 * to show who agreed, to which version, and when, and when they withdrew). One per visitor id.
 */
import { Schema } from "mongoose";

export const analyticsConsentSchema = new Schema({
  visitor_id: { type: String, required: true },
  accepted: { type: Boolean, required: true },
  version: { type: String, required: true },
  accepted_at: { type: Date, default: null },
  withdrawn_at: { type: Date, default: null },
});

analyticsConsentSchema.index({ visitor_id: 1 }, { unique: true });
