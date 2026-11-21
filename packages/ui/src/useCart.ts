"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { addLine, cartSubtotal, removeLine, setLineCount, setPieces, type CartLine, type CartSet, type QuotePromotion } from "@merch/shared";

/**
 * The shared cart state is mounted once for the lifetime of the app layout.
 * Cart rules live in @merch/shared's cart.ts.
 */
type CartState = {
  lines: CartLine[];
  /** Promotion sets (D13), each at its own price. */
  sets: CartSet[];
  /** Pieces: single lines and every piece of every set. */
  count: number;
  subtotal: number;
  add: (line: CartLine, max?: number) => void;
  setCount: (variantId: string, count: number, max?: number) => void;
  remove: (variantId: string) => void;
  addSet: (set: QuotePromotion) => void;
  removeSet: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);
// Only needs to be unique within this tab's cart (crypto.randomUUID needs HTTPS, so not on a LAN dev server).
let nextSetKey = 0;

/** The saved cart, or null when there is none or it isn't a cart (storage is the browser's, anything can be in it). */
function readSaved(key: string): { lines: CartLine[]; sets: CartSet[] } | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!saved || typeof saved !== "object") return null;
    const { lines, sets } = saved as { lines?: unknown; sets?: unknown };
    return Array.isArray(lines) && Array.isArray(sets) ? { lines, sets } : null;
  } catch {
    return null; // private mode, blocked storage, bad JSON
  }
}

/**
 * `storageKey` keeps the cart in localStorage, so a reload (a phone often reloads the tab after
 * the bank app) doesn't empty it. Prices and stock are checked again by POST /quote anyway.
 */
export function CartProvider({ children, initial = [], storageKey }: { children: ReactNode; initial?: CartLine[]; storageKey?: string }) {
  const [lines, setLines] = useState(initial);
  const [sets, setSets] = useState<CartSet[]>([]);
  // Read after the first render, so the server's HTML (an empty cart) and the browser's match.
  const [restored, setRestored] = useState(!storageKey);

  useEffect(() => {
    if (!storageKey) return;
    const saved = readSaved(storageKey);
    if (saved) {
      nextSetKey = Math.max(nextSetKey, ...saved.sets.map((s) => Number(s.key) || 0));
      setLines(saved.lines);
      setSets(saved.sets);
    }
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !restored) return; // never overwrite the saved cart with the empty first render
    try {
      localStorage.setItem(storageKey, JSON.stringify({ lines, sets }));
    } catch {
      // storage full or blocked: the cart still works for this page
    }
  }, [storageKey, restored, lines, sets]);
  const cart: CartState = {
    lines,
    sets,
    count: lines.reduce((sum, l) => sum + l.count, 0) + sets.reduce((sum, s) => sum + setPieces(s), 0),
    subtotal: cartSubtotal(lines, sets),
    add: (line: CartLine, max?: number) => setLines((ls) => addLine(ls, line, max)),
    setCount: (variantId: string, count: number, max?: number) => setLines((ls) => setLineCount(ls, variantId, count, max)),
    remove: (variantId: string) => setLines((ls) => removeLine(ls, variantId)),
    addSet: (set: QuotePromotion) => setSets((ss) => [...ss, { ...set, key: String(++nextSetKey) }]),
    removeSet: (key: string) => setSets((ss) => ss.filter((s) => s.key !== key)),
    clear: () => {
      setLines([]);
      setSets([]);
    },
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
