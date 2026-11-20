/**
 * Promotion sets for the dashboard (D13). DELETE archives, like products: an order may
 * still point at the set. Deleting a product or variant cascades (catalog.helper.ts).
 */
import type { PromotionItem, PromotionRequest } from "@merch/shared";
import type { Types } from "mongoose";
import type { z } from "zod";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

type Id = Types.ObjectId;
type Body = z.output<typeof PromotionRequest>;

export const listPromotions = (m: Models) => m.Promotion.find({ archived: false }).sort({ name: 1 }).lean();

export async function createPromotion(m: Models, body: Body) {
  await assertLiveItems(m, body.items);
  return (await m.Promotion.create(body)).toObject();
}

export async function updatePromotion(m: Models, id: Id, body: Body) {
  await assertLiveItems(m, body.items);
  const promotion = await m.Promotion.findOneAndUpdate({ _id: id, archived: false }, { $set: body }, { new: true, runValidators: true }).lean();
  if (!promotion) throw ApiError.notFound("Promotion not found");
  return promotion;
}

export async function archivePromotion(m: Models, id: Id) {
  const res = await m.Promotion.updateOne({ _id: id, archived: false }, { $set: { archived: true } });
  if (res.matchedCount === 0) throw ApiError.notFound("Promotion not found");
}

/** Each item names a live product and only live variants of it. */
async function assertLiveItems(m: Models, items: PromotionItem[]) {
  const products = await m.Product.find({ _id: { $in: items.map((i) => i.product_id) }, archived: false }, { variants: 1 }).lean();
  items.forEach((item, i) => {
    const product = products.find((p) => p._id.equals(item.product_id));
    if (!product) throw ApiError.validation(`items.${i}: no such product`);
    if (!item.variant_ids.every((vid) => product.variants.some((v) => v._id.equals(vid) && !v.archived))) {
      throw ApiError.validation(`items.${i}: no such variant`);
    }
  });
}
