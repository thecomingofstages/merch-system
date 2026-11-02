/**
 * Stock changes that must never go negative (docs/BACKEND.md "Business rules" 3).
 * Call inside a transaction: if any line fails, the caller's whole transaction aborts.
 */
import type { QuoteLine } from "@merch/shared";
import type { ClientSession } from "mongoose";
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
