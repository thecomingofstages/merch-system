/**
 * The one place amounts come from (docs/BACKEND.md "Business rules" 1, 2, 7).
 * POST /quote, POST /orders (S5) and POST /pos/:id/sales (S9) all call priceCart, so
 * the QR amount is the charged amount. Prices sent by a client are never read.
 */
import type { CartItem, QuoteLine, QuoteRequest } from "@merch/shared";
import { Types } from "mongoose";
import type { Config } from "../config/init";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

export type PricedCart = {
  lines: QuoteLine[];
  subtotal: number;
  shipping_fee: number;
  total: number;
};

/** Adds up lines for the same variant, so splitting one over two lines can't get around buy_limit. */
export function mergeLines(items: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const item of items) {
    const key = `${item.product_id}:${item.variant_id}`.toLowerCase();
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, count: prev.count + item.count } : { ...item });
  }
  return [...merged.values()];
}

/**
 * Prices a cart for a channel:
 * - ONLINE: visible_to_online variants only, against online_stock, plus SHIPPING_FEE once.
 * - POS: variants of that POS's shops only, against its pos_stock, no shipping.
 * Answers 409 BUY_LIMIT or OUT_OF_STOCK when a line can't be had. This is a check, not a
 * reservation: S5 and S9 deduct stock in a transaction and can still fail.
 */
export async function priceCart(m: Models, input: QuoteRequest, config: Pick<Config, "SHIPPING_FEE">): Promise<PricedCart> {
  const items = mergeLines(input.items);
  const products = await m.Product.find({
    _id: { $in: items.map((i) => new Types.ObjectId(i.product_id)) },
    archived: false,
  }).lean();

  const pos = input.channel === "POS" ? await m.Pos.findById(input.pos_id).lean() : null;
  if (input.channel === "POS" && !pos) throw ApiError.notFound("POS not found");

  const lines = items.map((item, i): QuoteLine => {
    const product = products.find((p) => p._id.equals(item.product_id));
    const variant = product?.variants.find((v) => v._id.equals(item.variant_id) && !v.archived);
    if (!product || !variant) throw ApiError.validation(`items.${i}: no such item`);

    let stock: number;
    if (pos) {
      if (!pos.shop_ids.some((s) => s.equals(product.shop_id))) throw ApiError.validation(`items.${i}: not sold at this POS`);
      stock =
        pos.products
          .find((p) => p.product_id.equals(product._id))
          ?.variants.find((v) => v.variants_id.equals(variant._id))?.pos_stock ?? 0;
    } else {
      if (!variant.visible_to_online) throw ApiError.validation(`items.${i}: no such item`);
      stock = variant.online_stock;
    }

    const label = `${product.name} (${variant.name})`;
    if (variant.buy_limit > 0 && item.count > variant.buy_limit) {
      throw ApiError.conflict("BUY_LIMIT", `${label}: at most ${variant.buy_limit} per order`);
    }
    if (item.count > stock) throw ApiError.conflict("OUT_OF_STOCK", `${label}: not enough stock`);

    return {
      product_id: String(product._id),
      product_name: product.name,
      variant_id: String(variant._id),
      variant_name: variant.name,
      count: item.count,
      unit_price: variant.price,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.count, 0);
  const shipping_fee = input.channel === "ONLINE" ? config.SHIPPING_FEE : 0;
  return { lines, subtotal, shipping_fee, total: subtotal + shipping_fee };
}
