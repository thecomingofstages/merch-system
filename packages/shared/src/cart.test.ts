import { describe, expect, it } from "vitest";
import { addLine, cartSubtotal, removeLine, setLineCount, type CartLine } from "./cart";

const line = (product_id: string, variant_id: string, count: number, unit_price: number): CartLine => ({
  product_id,
  product_name: `product ${product_id}`,
  variant_id,
  variant_name: `variant ${variant_id}`,
  count,
  unit_price,
});

describe("cartSubtotal", () => {
  it("is 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it("adds unit price times count over every line", () => {
    expect(cartSubtotal([line("p1", "a", 2, 100), line("p2", "b", 1, 150)])).toBe(350);
  });
});

describe("addLine", () => {
  it("merges a variant that is already in the cart", () => {
    const cart = addLine([line("p1", "a", 2, 100)], line("p1", "a", 3, 100));
    expect(cart).toEqual([line("p1", "a", 5, 100)]);
  });

  it("caps the merged count by max, so adding twice can't pass buy_limit", () => {
    const cart = addLine([line("p1", "a", 4, 100)], line("p1", "a", 4, 100), 5);
    expect(cart[0]?.count).toBe(5);
  });

  it("adds nothing when max is 0 (sold out)", () => {
    expect(addLine([], line("p1", "a", 1, 100), 0)).toEqual([]);
  });

  it("keeps a new variant next to the other lines of its product", () => {
    const cart = addLine([line("p1", "a", 1, 100), line("p2", "b", 1, 150)], line("p1", "c", 1, 120));
    expect(cart.map((l) => l.variant_id)).toEqual(["a", "c", "b"]);
  });
});

describe("setLineCount and removeLine", () => {
  it("changes a count, and removes the line below 1", () => {
    const cart = [line("p1", "a", 2, 100), line("p2", "b", 1, 150)];
    expect(setLineCount(cart, "a", 3)[0]?.count).toBe(3);
    expect(setLineCount(cart, "a", 0).map((l) => l.variant_id)).toEqual(["b"]);
    expect(removeLine(cart, "b").map((l) => l.variant_id)).toEqual(["a"]);
  });
});
