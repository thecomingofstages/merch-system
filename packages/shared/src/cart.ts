/**
 * The cart in the browser (task 1.2). Lines have the same shape as POST /quote's,
 * so CartSummary shows either. The subtotal is for display while browsing only:
 * the amount to pay always comes from POST /quote (docs/FRONTEND.md "Rules every app follows").
 */
import type { QuoteLine } from "./schemas/quote";

export type CartLine = QuoteLine;

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unit_price * line.count, 0);
}

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
