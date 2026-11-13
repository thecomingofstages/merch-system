"use client";

import { createContext, createElement, useContext, useState, type ReactNode } from "react";
import { addLine, cartSubtotal, removeLine, setLineCount, type CartLine } from "@merch/shared";

/**
 * The shared cart state is mounted once for the lifetime of the app layout.
 * Cart rules live in @merch/shared's cart.ts.
 */
type CartState = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: CartLine, max?: number) => void;
  setCount: (variantId: string, count: number, max?: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children, initial = [] }: { children: ReactNode; initial?: CartLine[] }) {
  const [lines, setLines] = useState(initial);
  const cart: CartState = {
    lines,
    count: lines.reduce((sum, l) => sum + l.count, 0),
    subtotal: cartSubtotal(lines),
    add: (line: CartLine, max?: number) => setLines((ls) => addLine(ls, line, max)),
    setCount: (variantId: string, count: number, max?: number) => setLines((ls) => setLineCount(ls, variantId, count, max)),
    remove: (variantId: string) => setLines((ls) => removeLine(ls, variantId)),
    clear: () => setLines([]),
  };

  return createElement(CartContext.Provider, { value: cart }, children);
}

/** `max` is the cap from maxCount (stock and buy_limit) for that variant. */
export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return cart;
}
