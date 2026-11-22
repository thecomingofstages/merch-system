import { describe, expect, it } from "vitest";
import { pickMax, setSoldOut } from "./PromotionPopup";

describe("pickMax", () => {
  it("lets a variant fill what the item still needs, capped by its stock", () => {
    expect(pickMax(5, 0, 3, 0)).toBe(3);
    expect(pickMax(5, 1, 3, 2)).toBe(2); // 1 of this, 1 of another: this can go to 2
    expect(pickMax(1, 0, 3, 0)).toBe(1);
    expect(pickMax(0, 0, 3, 0)).toBe(0);
  });
});

describe("setSoldOut", () => {
  const set = {
    _id: "s", name: "s", description: "", image: null, price: 1, discount_percent: 0, free_shipping: false,
    items: [{ product_id: "p", product_name: "p", count: 2, variants: [{ _id: "a", name: "a", image: null, stock: 1 }, { _id: "b", name: "b", image: null, stock: 1 }] }],
  };
  it("is sold out only when an item's variants together can't fill its count", () => {
    expect(setSoldOut(set, (v) => v.stock)).toBe(false);
    expect(setSoldOut(set, (v) => (v._id === "a" ? 1 : 0))).toBe(true);
  });
});
