/**
 * The cart in the browser (task 1.2). Lines have the same shape as POST /quote's,
 * so CartSummary shows either. The subtotal is for display while browsing only:
 * the amount to pay always comes from POST /quote (docs/FRONTEND.md "Rules every app follows").
 */
import type { CatalogResponse } from "./schemas/catalog";
import type { QuoteLine, QuotePromotion } from "./schemas/quote";

export type CartLine = QuoteLine;
/** A promotion set in the cart (D13). `key` tells apart two copies of one set with different picks. */
export type CartSet = QuotePromotion & { key: string };

export function cartSubtotal(lines: CartLine[], sets: Pick<CartSet, "price">[] = []): number {
  return lines.reduce((sum, line) => sum + line.unit_price * line.count, 0) + sets.reduce((sum, s) => sum + s.price, 0);
}

/** Pieces in a set: the cart counts items, not sets. */
export const setPieces = (set: Pick<CartSet, "picks">) => set.picks.flat().reduce((sum, p) => sum + p.count, 0);

/** The request shape of a cart set (POST /quote, /orders, /pos/:id/sales). */
export const setRequest = ({ promotion_id, picks }: CartSet) => ({
  promotion_id,
  picks: picks.map((item) => item.map(({ variant_id, count }) => ({ variant_id, count }))),
});

/**
 * Adds `line.count` of a variant. A variant already in the cart is merged into its line;
 * a new variant goes after the other lines of its product, so lines stay grouped by product.
 * `max` (from maxCount: stock and buy_limit) caps the merged count, so adding twice can't pass buy_limit.
 */
export function addLine(lines: CartLine[], line: CartLine, max = Infinity): CartLine[] {
  const existing = lines.find((l) => l.variant_id === line.variant_id);
  if (existing) return setLineCount(lines, line.variant_id, existing.count + line.count, max);
  const count = Math.min(line.count, max);
  if (count < 1) return lines;
  let at = lines.length;
  lines.forEach((l, i) => {
    if (l.product_id === line.product_id) at = i + 1;
  });
  return [...lines.slice(0, at), { ...line, count }, ...lines.slice(at)];
}

/** Sets a line's count, capped by `max`; below 1 removes the line. */
export function setLineCount(lines: CartLine[], variantId: string, count: number, max = Infinity): CartLine[] {
  const capped = Math.min(count, max);
  if (capped < 1) return removeLine(lines, variantId);
  return lines.map((l) => (l.variant_id === variantId ? { ...l, count: capped } : l));
}

export function removeLine(lines: CartLine[], variantId: string): CartLine[] {
  return lines.filter((l) => l.variant_id !== variantId);
}

/**
 * Cart lines the latest GET /catalog no longer covers, with what is left of each:
 * 0 when the variant sold out or left the catalog. The checkout re-checks with this.
 */
export function stockShortfalls(lines: CartLine[], catalog: CatalogResponse): { line: CartLine; available: number }[] {
  const variants = catalog.shops.flatMap((s) => s.products.flatMap((p) => p.variants));
  return lines.flatMap((line) => {
    const variant = variants.find((v) => v._id === line.variant_id);
    const available = !variant || variant.sold_out ? 0 : variant.online_stock;
    return line.count > available ? [{ line, available }] : [];
  });
}

/**
 * Cart sets the latest GET /catalog can no longer fill: the set is gone or switched off,
 * or a chosen variant is gone or has less stock than was picked. The checkout drops them whole.
 */
export function unavailableSets(sets: CartSet[], catalog: CatalogResponse): CartSet[] {
  return sets.filter((set) => {
    const promotion = catalog.promotions.find((p) => p._id === set.promotion_id);
    return (
      !promotion ||
      set.picks.some((picks, i) =>
        picks.some((pick) => {
          const variant = promotion.items[i]?.variants.find((v) => v._id === pick.variant_id);
          return !variant || variant.online_stock < pick.count;
        }),
      )
    );
  });
}
