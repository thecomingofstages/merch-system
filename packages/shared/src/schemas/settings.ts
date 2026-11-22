/**
 * Shop-wide promotion settings (GET and PATCH /admin/settings): free online shipping once the
 * cart, after any discount, reaches `free_shipping_min` baht.
 */
import { z } from "zod";

export const Settings = z.object({
  free_shipping_enabled: z.boolean(),
  /** Whole baht, at least 1: 0 would make shipping free for everyone (switch it off instead). */
  free_shipping_min: z.number().int().min(1),
});
export type Settings = z.infer<typeof Settings>;
