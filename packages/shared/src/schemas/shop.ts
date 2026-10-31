/** Shops (docs/BACKEND.md "Data model"). */
import { z } from "zod";

export const ShopRequest = z.object({
  shop_name: z.string().trim().min(1),
});
export type ShopRequest = z.infer<typeof ShopRequest>;

export const Shop = ShopRequest.extend({
  _id: z.string(),
  archived: z.boolean(),
});
export type Shop = z.infer<typeof Shop>;
