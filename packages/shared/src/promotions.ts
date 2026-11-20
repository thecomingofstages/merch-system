/**
 * Promotion set rules (D13), shared by the server's priceCart and the fixtures, so both
 * check a set the same way. Pure: the caller loads the promotions and products.
 */
import type { CatalogPromotion } from "./schemas/catalog";
import type { PromotionCartItem, QuotePromotion, SetPick } from "./schemas/quote";

type SetProduct = { _id: string; name: string; variants: { _id: string; name: string; archived: boolean }[] };
type SetPromotion = { _id: string; name: string; price: number; items: { product_id: string; variant_ids: string[]; count: number }[] };

/** A set the request can't have. The server answers 400 VALIDATION with the message. */
export class SetError extends Error {}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Checks each set in the cart against its promotion: every item filled, each item's picks
 * adding up to its count, only that item's live variants (mixing allowed). Pass only the
 * promotions on sale and the products the channel may sell; anything else is "no such".
 */
export function priceSets(entries: PromotionCartItem[], promotions: SetPromotion[], products: SetProduct[]): QuotePromotion[] {
  return entries.map((entry, i) => {
    const at = `promotions.${i}`;
    const promotion = promotions.find((p) => same(p._id, entry.promotion_id));
    if (!promotion) throw new SetError(`${at}: no such set`);
    if (entry.picks.length !== promotion.items.length) throw new SetError(`${at}: pick every item of the set`);
    const picks = promotion.items.map((item, j) => {
      const chosen = entry.picks[j]!;
      if (chosen.reduce((sum, c) => sum + c.count, 0) !== item.count) {
        throw new SetError(`${at}.picks.${j}: pick ${item.count} in all`);
      }
      const product = products.find((p) => same(p._id, item.product_id));
      return chosen.map((c): SetPick => {
        const allowed = item.variant_ids.some((v) => same(v, c.variant_id));
        const variant = allowed ? product?.variants.find((v) => same(v._id, c.variant_id) && !v.archived) : undefined;
        if (!product || !variant) throw new SetError(`${at}.picks.${j}: no such variant`);
        return { product_id: product._id, product_name: product.name, variant_id: variant._id, variant_name: variant.name, count: c.count };
      });
    });
    return { promotion_id: promotion._id, name: promotion.name, price: promotion.price, picks };
  });
}

/** Every variant the cart takes, single lines and set pieces added up: what the stock must cover. */
export function stockDemand(lines: SetPick[], sets: QuotePromotion[]): SetPick[] {
  const demand = new Map<string, SetPick>();
  for (const { product_id, product_name, variant_id, variant_name, count } of [...lines, ...sets.flatMap((s) => s.picks.flat())]) {
    const key = variant_id.toLowerCase();
    const prev = demand.get(key);
    demand.set(key, { product_id, product_name, variant_id, variant_name, count: (prev?.count ?? 0) + count });
  }
  return [...demand.values()];
}

type CatalogSource = {
  _id: string;
  name: string;
  variants: { _id: string; name: string; image: string | null; online_stock: number; archived: boolean }[];
};
type CatalogSourcePromotion = SetPromotion & { description: string; image: string | null; active: boolean; archived: boolean };

/**
 * The sets GET /catalog shows: active ones, each item with its live allowed variants and
 * their online stock. Pass live products only. A set with an item that has no variant left is
 * hidden (cascading deletes normally archive it first).
 */
export function catalogPromotions(promotions: CatalogSourcePromotion[], products: CatalogSource[]): CatalogPromotion[] {
  return promotions
    .filter((p) => p.active && !p.archived)
    .flatMap((p) => {
      const items = p.items.map((item) => {
        const product = products.find((pr) => same(pr._id, item.product_id));
        const variants = (product?.variants ?? [])
          .filter((v) => !v.archived && item.variant_ids.some((id) => same(id, v._id)))
          .map(({ _id, name, image, online_stock }) => ({ _id, name, image, online_stock }));
        return { product_id: item.product_id, product_name: product?.name ?? "", count: item.count, variants };
      });
      if (items.some((i) => i.variants.length === 0)) return [];
      const sold_out = items.some((i) => i.variants.reduce((sum, v) => sum + Math.max(v.online_stock, 0), 0) < i.count);
      return [{ _id: p._id, name: p.name, description: p.description, image: p.image, price: p.price, sold_out, items }];
    });
}

type CascadeSet = { _id: string; name: string; archived: boolean; items: { product_id: string; variant_ids: string[] }[] };

/**
 * What deleting products, or one variant, does to the live sets (D13), as the server's
 * cascade does it: deleting a product deletes its sets; deleting a variant removes it from
 * them, and deletes a set whose item had no other variant. For the dashboard's warning.
 */
export function deleteImpact<S extends CascadeSet>(sets: S[], target: { productIds: string[] } | { variantId: string }) {
  const live = sets.filter((s) => !s.archived);
  if ("productIds" in target) {
    return { deleted: live.filter((s) => s.items.some((i) => target.productIds.some((p) => same(p, i.product_id)))), shrunk: [] };
  }
  const holds = (ids: string[]) => ids.some((v) => same(v, target.variantId));
  const holding = live.filter((s) => s.items.some((i) => holds(i.variant_ids)));
  const deleted = holding.filter((s) => s.items.some((i) => i.variant_ids.length > 0 && i.variant_ids.every((v) => same(v, target.variantId))));
  return { deleted, shrunk: holding.filter((s) => !deleted.includes(s)) };
}
