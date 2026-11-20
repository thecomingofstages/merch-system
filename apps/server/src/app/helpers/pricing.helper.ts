/**
 * The one place amounts come from (docs/BACKEND.md "Business rules" 1, 2, 7).
 * POST /quote, POST /orders (S5) and POST /pos/:id/sales (S9) all call priceCart, so
 * the QR amount is the charged amount. Prices sent by a client are never read.
 */
import { priceSets, SetError, stockDemand, type CartItem, type QuoteLine, type QuotePromotion, type QuoteRequest } from "@merch/shared";
import { type ClientSession, Types } from "mongoose";
import type { Config } from "../config/init";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

export type PricedCart = {
  lines: QuoteLine[];
  promotions: QuotePromotion[];
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

const oid = (id: string) => new Types.ObjectId(id);

/**
 * Prices a cart for a channel:
 * - ONLINE: visible_to_online variants only, against online_stock, plus SHIPPING_FEE once.
 * - POS: variants of that POS's shops only, against its pos_stock, no shipping.
 * Promotion sets (D13) cost their own price, ignore buy_limit and visible_to_online, and
 * share the stock with single lines. Answers 409 BUY_LIMIT or OUT_OF_STOCK when a line can't
 * be had. This is a check, not a reservation: S5 and S9 deduct stock in a transaction and can
 * still fail. Pass their `session` so these reads are part of it. `checkStock: false` only
 * prices (a REFUND_DUE record).
 */
export async function priceCart(
  m: Models,
  input: QuoteRequest,
  config: Pick<Config, "SHIPPING_FEE">,
  session: ClientSession | null = null,
  checkStock = true,
): Promise<PricedCart> {
  const items = mergeLines(input.items);
  const entries = input.promotions ?? [];
  if (items.length + entries.length === 0) throw ApiError.validation("items: the cart is empty");

  const promotions = entries.length
    ? await m.Promotion.find({ _id: { $in: entries.map((e) => oid(e.promotion_id)) }, active: true, archived: false })
        .session(session)
        .lean()
    : [];
  const productIds = [...items.map((i) => i.product_id), ...promotions.flatMap((p) => p.items.map((it) => String(it.product_id)))];
  const products = await m.Product.find({ _id: { $in: productIds.map(oid) }, archived: false })
    .session(session)
    .lean();

  const pos = input.channel === "POS" ? await m.Pos.findById(input.pos_id).session(session).lean() : null;
  if (input.channel === "POS" && !pos) throw ApiError.notFound("POS not found");
  const sold = (product: (typeof products)[number]) => !pos || pos.shop_ids.some((s) => s.equals(product.shop_id));
  const stockOf = (productId: string, variantId: string) => {
    const product = products.find((p) => p._id.equals(productId));
    const variant = product?.variants.find((v) => v._id.equals(variantId));
    if (!product || !variant) return 0;
    if (!pos) return variant.online_stock;
    return (
      pos.products.find((p) => p.product_id.equals(product._id))?.variants.find((v) => v.variants_id.equals(variant._id))
        ?.pos_stock ?? 0
    );
  };

  const lines = items.map((item, i): QuoteLine => {
    const product = products.find((p) => p._id.equals(item.product_id));
    const variant = product?.variants.find((v) => v._id.equals(item.variant_id) && !v.archived);
    if (!product || !variant) throw ApiError.validation(`items.${i}: no such item`);
    if (!sold(product)) throw ApiError.validation(`items.${i}: not sold at this POS`);
    if (!pos && !variant.visible_to_online) throw ApiError.validation(`items.${i}: no such item`);

    const label = `${product.name} (${variant.name})`;
    if (variant.buy_limit > 0 && item.count > variant.buy_limit) {
      throw ApiError.conflict("BUY_LIMIT", `${label}: at most ${variant.buy_limit} per order`);
    }

    return {
      product_id: String(product._id),
      product_name: product.name,
      variant_id: String(variant._id),
      variant_name: variant.name,
      count: item.count,
      unit_price: variant.price,
    };
  });

  let sets: QuotePromotion[];
  try {
    sets = priceSets(
      entries,
      promotions.map((p) => ({
        _id: String(p._id),
        name: p.name,
        price: p.price,
        items: p.items.map((it) => ({ product_id: String(it.product_id), variant_ids: it.variant_ids.map(String), count: it.count })),
      })),
      // A POS sells a set only when every item's shop is one of its shops.
      products.filter(sold).map((p) => ({
        _id: String(p._id),
        name: p.name,
        variants: p.variants.map((v) => ({ _id: String(v._id), name: v.name, archived: v.archived })),
      })),
    );
  } catch (err) {
    if (err instanceof SetError) throw ApiError.validation(err.message);
    throw err;
  }

  if (checkStock) {
    for (const d of stockDemand(lines, sets)) {
      if (d.count > stockOf(d.product_id, d.variant_id)) {
        throw ApiError.conflict("OUT_OF_STOCK", `${d.product_name} (${d.variant_name}): not enough stock`);
      }
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.count, 0) + sets.reduce((sum, s) => sum + s.price, 0);
  const shipping_fee = input.channel === "ONLINE" ? config.SHIPPING_FEE : 0;
  return { lines, promotions: sets, subtotal, shipping_fee, total: subtotal + shipping_fee };
}
