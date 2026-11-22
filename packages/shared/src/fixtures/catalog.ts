// Placeholder data for development. Not real TCOS products or prices.
import type { CatalogResponse } from "../schemas/catalog";
import type { ErrorCode } from "../schemas/common";
import type { Product } from "../schemas/product";
import type { Promotion } from "../schemas/promotion";
import type { Settings } from "../schemas/settings";
import { catalogPromotions, priceExtras, priceSets, SetError, stockDemand } from "../promotions";
import { QuoteRequest, type CartItem, type QuoteLine, type QuoteResponse } from "../schemas/quote";
import type { Shop } from "../schemas/shop";
import { fixtureProducts } from "./products";
import { fixturePromotions, fixtureSettings } from "./promotions";
import { fixtureShops } from "./shops";

// TODO(SHIPPING_FEE value): placeholder shipping fee for fixtures mode only.
export const FAKE_SHIPPING_FEE = 60;
export const FAKE_PROMPTPAY_ID = "0000000000000";
export const FAKE_PROMPTPAY_NAME = "Placeholder account";

export class FixtureError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FixtureError";
  }
}

/**
 * Builds a CatalogResponse from shops and products applying the real server rules:
 * non-archived shops and products, only visible_to_online and non-archived variants,
 * and sold_out = online_stock === 0. Products with no visible variants are excluded.
 */
export function toCatalog(
  shops: readonly Shop[],
  products: readonly Product[],
  promotions: readonly Promotion[] = fixturePromotions,
  settings: Settings = fixtureSettings,
): CatalogResponse {
  return {
    free_shipping_over: settings.free_shipping_enabled ? settings.free_shipping_min : null,
    promotions: catalogPromotions([...promotions], products.filter((p) => !p.archived)),
    shops: [...shops]
      .filter((s) => !s.archived)
      .sort((a, b) => a.shop_name.localeCompare(b.shop_name))
      .map((shop) => ({
        _id: shop._id,
        shop_name: shop.shop_name,
        products: [...products]
          .filter((p) => !p.archived && p.shop_id === shop._id)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({
            _id: p._id,
            name: p.name,
            description: p.description,
            image: [...p.image],
            variants: p.variants
              .filter((v) => v.visible_to_online && !v.archived)
              .map((v) => ({
                _id: v._id,
                name: v.name,
                price: v.price,
                image: v.image,
                online_stock: v.online_stock,
                buy_limit: v.buy_limit,
                sold_out: v.online_stock <= 0,
              })),
          }))
          .filter((p) => p.variants.length > 0),
      })),
  };
}

export const fixtureCatalog: CatalogResponse = toCatalog(fixtureShops, fixtureProducts);

function mergeFixtureLines(items: readonly CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();
  for (const item of items) {
    const key = `${item.product_id}:${item.variant_id}`.toLowerCase();
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, count: prev.count + item.count } : { ...item });
  }
  return [...merged.values()];
}

/**
 * Fixtures mode only. In real mode the amount always comes from POST /quote.
 */
export function mockQuoteForFixtures(
  rawInput: QuoteRequest,
  products: readonly Product[] = fixtureProducts,
  promotions: readonly Promotion[] = fixturePromotions,
  settings: Settings = fixtureSettings,
): QuoteResponse {
  const parsed = QuoteRequest.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new FixtureError(400, "VALIDATION", issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid quote request");
  }
  const input = parsed.data;
  const items = mergeFixtureLines(input.items);

  const lines: QuoteLine[] = items.map((item, i) => {
    const product = products.find((p) => p._id === item.product_id && !p.archived);
    const variant = product?.variants.find((v) => v._id === item.variant_id && !v.archived);
    if (!product || !variant) {
      throw new FixtureError(400, "VALIDATION", `items.${i}: no such item`);
    }
    if (input.channel === "ONLINE" && !variant.visible_to_online) {
      throw new FixtureError(400, "VALIDATION", `items.${i}: no such item`);
    }

    const label = `${product.name} (${variant.name})`;
    if (variant.buy_limit > 0 && item.count > variant.buy_limit) {
      throw new FixtureError(409, "BUY_LIMIT", `${label}: at most ${variant.buy_limit} per order`);
    }

    return {
      product_id: product._id,
      product_name: product.name,
      variant_id: variant._id,
      variant_name: variant.name,
      count: item.count,
      unit_price: variant.price,
    };
  });

  let sets;
  try {
    const onSale = promotions.filter((p) => p.active && !p.archived);
    sets = priceSets(input.promotions ?? [], onSale, products.filter((p) => !p.archived));
  } catch (err) {
    if (err instanceof SetError) throw new FixtureError(400, "VALIDATION", err.message);
    throw err;
  }
  if (lines.length + sets.length === 0) throw new FixtureError(400, "VALIDATION", "items: the cart is empty");
  // Single lines and set pieces share the stock (D13).
  for (const d of stockDemand(lines, sets)) {
    const variant = products.find((p) => p._id === d.product_id)?.variants.find((v) => v._id === d.variant_id);
    if (!variant || d.count > variant.online_stock) {
      throw new FixtureError(409, "OUT_OF_STOCK", `${d.product_name} (${d.variant_name}): not enough stock`);
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.count, 0) + sets.reduce((sum, s) => sum + s.price, 0);
  const { discount, shipping_fee } = priceExtras({
    subtotal,
    sets: sets.map((s) => promotions.find((p) => p._id === s.promotion_id)!),
    online: input.channel === "ONLINE",
    fee: FAKE_SHIPPING_FEE,
    settings,
  });
  return {
    lines,
    promotions: sets,
    subtotal,
    discount,
    shipping_fee,
    total: subtotal - discount + shipping_fee,
    promptpay_id: FAKE_PROMPTPAY_ID,
    promptpay_name: FAKE_PROMPTPAY_NAME,
  };
}
