import { z } from "zod";
import { ObjectId } from "./common";

export const Shop = z.object({
  _id: ObjectId,
  shop_name: z.string().trim().min(1),
  archived: z.boolean(),
});
export type Shop = z.infer<typeof Shop>;

export const CreateShopRequest = z.object({
  shop_name: z.string().trim().min(1),
});
export type CreateShopRequest = z.infer<typeof CreateShopRequest>;

export const UpdateShopRequest = z.object({
  shop_name: z.string().trim().min(1).optional(),
  archived: z.boolean().optional(),
});
export type UpdateShopRequest = z.infer<typeof UpdateShopRequest>;
