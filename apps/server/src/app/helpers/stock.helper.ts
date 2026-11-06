/**
 * Stock changes that must never go negative (docs/BACKEND.md "Business rules" 3).
 * Call inside a transaction: if any line fails, the caller's whole transaction aborts.
 */
import type { QuoteLine } from "@merch/shared";
import type { ClientSession, Types } from "mongoose";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

/**
 * Takes each line's count off online_stock with a conditional $inc. The filter only
 * matches while online_stock covers the count, so two orders for the last item can't
 * both succeed. Checks modifiedCount: the product still matches when the variant is short.
 */
export async function deductOnlineStock(m: Models, lines: QuoteLine[], session: ClientSession) {
  for (const line of lines) {
    const res = await m.Product.updateOne(
      { _id: line.product_id, archived: false },
      { $inc: { "variants.$[v].online_stock": -line.count } },
      {
        session,
        arrayFilters: [{ "v._id": line.variant_id, "v.archived": false, "v.online_stock": { $gte: line.count } }],
      },
    );
    if (res.modifiedCount !== 1) {
      throw ApiError.conflict("OUT_OF_STOCK", `${line.product_name} (${line.variant_name}): not enough stock`);
    }
  }
}

/** Takes each line's count off this POS's pos_stock, on the same terms as deductOnlineStock. */
export async function deductPosStock(m: Models, posId: Types.ObjectId, lines: QuoteLine[], session: ClientSession) {
  for (const line of lines) {
    const res = await m.Pos.updateOne(
      { _id: posId },
      { $inc: { "products.$[p].variants.$[v].pos_stock": -line.count } },
      {
        session,
        arrayFilters: [{ "p.product_id": line.product_id }, { "v.variants_id": line.variant_id, "v.pos_stock": { $gte: line.count } }],
      },
    );
    if (res.modifiedCount !== 1) {
      throw ApiError.conflict("OUT_OF_STOCK", `${line.product_name} (${line.variant_name}): not enough stock`);
    }
  }
}

/** Puts counts back on online_stock: a rejected order (S7) or the end of a POS sale (S8). */
export async function returnOnlineStock(
  m: Models,
  products: { products_id: Types.ObjectId; variants: { variants_id: Types.ObjectId; count: number }[] }[],
  session: ClientSession,
) {
  for (const product of products) {
    for (const variant of product.variants) {
      await m.Product.updateOne(
        { _id: product.products_id },
        { $inc: { "variants.$[v].online_stock": variant.count } },
        { session, arrayFilters: [{ "v._id": variant.variants_id }] },
      );
    }
  }
}
