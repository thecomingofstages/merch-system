import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductPopup, maxCount, remainingCount } from "./ProductPopup";

describe("maxCount", () => {
  it("caps by stock when there is no buy_limit (0)", () => {
    expect(maxCount(0, 7)).toBe(7);
  });

  it("caps by buy_limit when it is below stock", () => {
    expect(maxCount(2, 7)).toBe(2);
  });

  it("caps by stock when it is below buy_limit", () => {
    expect(maxCount(5, 3)).toBe(3);
  });

  it("allows none when sold out, even with negative stock", () => {
    expect(maxCount(5, 0)).toBe(0);
    expect(maxCount(0, -1)).toBe(0);
  });
});

describe("remainingCount", () => {
  it("subtracts the quantity already in the cart from the buy limit", () => {
    expect(remainingCount(maxCount(2, 7), 1)).toBe(1);
  });

  it("does not allow adding more after the buy limit is already in the cart", () => {
    expect(remainingCount(maxCount(2, 7), 2)).toBe(0);
  });

  it("subtracts the quantity already in the cart from available stock", () => {
    expect(remainingCount(maxCount(0, 3), 2)).toBe(1);
  });

  it("never returns a negative amount", () => {
    expect(remainingCount(maxCount(2, 7), 3)).toBe(0);
  });
});

describe("ProductPopup availability", () => {
  it.each([
    { stock: 7, buy_limit: 2, in_cart: 2, message: "TODO(Thai copy for buy limit reached)", can_add: false },
    { stock: 0, buy_limit: 2, in_cart: 2, message: "สินค้าหมด", can_add: false },
    { stock: -1, buy_limit: 0, in_cart: 0, message: "สินค้าหมด", can_add: false },
    { stock: 3, buy_limit: 0, in_cart: 3, message: "สินค้าหมด", can_add: false },
    { stock: 2, buy_limit: 2, in_cart: 2, message: "สินค้าหมด", can_add: false },
    { stock: 7, buy_limit: 2, in_cart: 1, message: "", can_add: true },
  ])("shows the correct availability for $stock stock, $buy_limit limit, $in_cart in cart", ({ stock, buy_limit, in_cart, message, can_add }) => {
    const html = renderToStaticMarkup(createElement(ProductPopup, {
      product: {
        _id: "a".repeat(24), name: "", description: "", image: [],
        variants: [{ _id: "b".repeat(24), name: "", price: 0, image: "", buy_limit }],
      },
      stockOf: () => stock,
      inCart: () => in_cart,
      onAdd: () => {},
      onClose: () => {},
    }));

    expect(html.includes("ใส่ตะกร้า")).toBe(can_add);
    if (message) expect(html).toContain(`<p class="text-curtain">${message}</p>`);
    expect(html.includes("TODO(Thai copy for buy limit reached)")).toBe(message.startsWith("TODO("));
  });
});
