import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCard } from "./ProductCard";

const product = {
  _id: "a".repeat(24),
  shop_id: "b".repeat(24),
  name: "Cap",
  description: "",
  image: [],
  variants: [{ _id: "c".repeat(24), name: "Red", price: 190, image: null, buy_limit: 0 }],
};
const card = (props: { stock: number; inCart?: number; buy?: boolean }) =>
  renderToStaticMarkup(
    createElement(ProductCard, { product, stockOf: () => props.stock, onOpen: () => {}, inCart: props.inCart, onBuy: props.buy === false ? undefined : () => {} }),
  );

describe("ProductCard", () => {
  it("has the two buttons, each naming the product for screen readers", () => {
    const html = card({ stock: 3 });
    expect(html).toContain('ดูรายละเอียด<span class="sr-only"> Cap</span>');
    expect(html).toContain('ใส่ตะกร้า<span class="sr-only"> Cap</span>');
  });

  it("shows the cart count on the picture only from 1, and says it to screen readers", () => {
    expect(card({ stock: 3, inCart: 0 })).not.toContain("ในตะกร้า");
    const html = card({ stock: 3, inCart: 2 });
    expect(html).toMatch(/bg-gold[^>]*>2<\/span>/);
    expect(html).toContain(" ในตะกร้า 2 ชิ้น");
  });

  it("can't add a sold-out product, but can still show it", () => {
    const html = card({ stock: 0 });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>ใส่ตะกร้า/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>ดูรายละเอียด/);
  });

  it("has no add button where the caller doesn't add from cards", () => {
    expect(card({ stock: 3, buy: false })).not.toContain("ใส่ตะกร้า");
  });
});
