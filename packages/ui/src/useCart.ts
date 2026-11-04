"use client";

import { useState } from "react";
import { addLine, cartSubtotal, removeLine, setLineCount, type CartLine } from "@merch/shared";

/**
 * Cart state for one page (task 1.2). The rules live in @merch/shared's cart.ts.
 * `max` is the cap from maxCount (stock and buy_limit) for that variant.
 */
export function useCart(initial: CartLine[] = []) {
  const [lines, setLines] = useState(initial);
  return {
    lines,
    count: lines.reduce((sum, l) => sum + l.count, 0),
    subtotal: cartSubtotal(lines),
    add: (line: CartLine, max?: number) => setLines((ls) => addLine(ls, line, max)),
    setCount: (variantId: string, count: number, max?: number) => setLines((ls) => setLineCount(ls, variantId, count, max)),
    remove: (variantId: string) => setLines((ls) => removeLine(ls, variantId)),
    clear: () => setLines([]),
  };
}
