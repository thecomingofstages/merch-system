import { describe, expect, it } from "vitest";
import { cartSubtotal, setPieces, unavailableSets, type CartSet } from "./cart";
import { catalogPromotions, deleteImpact, priceSets, SetError, stockDemand } from "./promotions";

const v = (_id: string, online_stock = 5, archived = false) => ({ _id, name: _id.toUpperCase(), image: null, online_stock, archived });
const shirt = { _id: "p1", name: "shirt", variants: [v("s"), v("m", 1), v("old", 5, true)] };
const bag = { _id: "p2", name: "bag", variants: [v("b")] };
const set = {
  _id: "set1",
  name: "Set",
  description: "",
  image: null,
  price: 599,
  active: true,
  archived: false,
  items: [
    { product_id: "p1", variant_ids: ["s", "m", "old"], count: 2 },
    { product_id: "p2", variant_ids: ["b"], count: 1 },
  ],
};
const entry = (picks: { variant_id: string; count: number }[][]) => ({ promotion_id: "set1", picks });

describe("priceSets", () => {
  it("prices a set at its own price, mixing variants within an item", () => {
    const [priced] = priceSets([entry([[{ variant_id: "s", count: 1 }, { variant_id: "m", count: 1 }], [{ variant_id: "b", count: 1 }]])], [set], [shirt, bag]);
    expect(priced).toMatchObject({ promotion_id: "set1", price: 599 });
    expect(priced!.picks.map((item) => item.map((p) => `${p.variant_name}×${p.count}`))).toEqual([["S×1", "M×1"], ["B×1"]]);
  });

  it.each([
    ["an item not filled", [[{ variant_id: "s", count: 2 }]]],
    ["a wrong count", [[{ variant_id: "s", count: 3 }], [{ variant_id: "b", count: 1 }]]],
    ["a variant of another item", [[{ variant_id: "b", count: 2 }], [{ variant_id: "b", count: 1 }]]],
    ["an archived variant", [[{ variant_id: "old", count: 2 }], [{ variant_id: "b", count: 1 }]]],
  ])("refuses %s", (_, picks) => {
    expect(() => priceSets([entry(picks)], [set], [shirt, bag])).toThrow(SetError);
  });

  it("refuses a set that isn't on sale or whose product isn't sold here", () => {
    const picks = [[{ variant_id: "s", count: 2 }], [{ variant_id: "b", count: 1 }]];
    expect(() => priceSets([entry(picks)], [], [shirt, bag])).toThrow("no such set");
    expect(() => priceSets([entry(picks)], [set], [shirt])).toThrow("no such variant");
  });
});

describe("stockDemand", () => {
  it("adds single lines and set pieces of the same variant", () => {
    const line = { product_id: "p1", product_name: "shirt", variant_id: "s", variant_name: "S", count: 1, unit_price: 250 };
    const sets = priceSets([entry([[{ variant_id: "s", count: 2 }], [{ variant_id: "b", count: 1 }]])], [set], [shirt, bag]);
    expect(stockDemand([line], sets).map((d) => [d.variant_id, d.count])).toEqual([["s", 3], ["b", 1]]);
  });
});

describe("catalogPromotions", () => {
  it("shows active sets with their live allowed variants, sold out when an item can't be filled", () => {
    const [shown] = catalogPromotions([set, { ...set, _id: "off", active: false }], [shirt, bag]);
    expect(shown!.items[0]!.variants.map((x) => x._id)).toEqual(["s", "m"]);
    expect(shown!.sold_out).toBe(false);
    const low = { ...shirt, variants: [v("s", 1), v("m", 0)] };
    expect(catalogPromotions([set], [low, bag])[0]!.sold_out).toBe(true);
    expect(catalogPromotions([set], [shirt])).toEqual([]);
  });
});

describe("cart sets", () => {
  const cartSet: CartSet = { key: "k", ...priceSets([entry([[{ variant_id: "s", count: 1 }, { variant_id: "m", count: 1 }], [{ variant_id: "b", count: 1 }]])], [set], [shirt, bag])[0]! };

  it("adds the set price to the subtotal and counts its pieces", () => {
    expect(cartSubtotal([], [cartSet])).toBe(599);
    expect(setPieces(cartSet)).toBe(3);
  });

  it("drops a set whose promotion left the catalog or whose pick has too little stock", () => {
    const catalog = { shops: [], promotions: catalogPromotions([set], [shirt, bag]) };
    expect(unavailableSets([cartSet], catalog)).toEqual([]);
    expect(unavailableSets([cartSet], { shops: [], promotions: [] })).toEqual([cartSet]);
    const short = { shops: [], promotions: catalogPromotions([set], [{ ...shirt, variants: [v("s"), v("m", 0)] }, bag]) };
    expect(unavailableSets([cartSet], short)).toEqual([cartSet]);
  });
});

describe("deleteImpact", () => {
  const other = { ...set, _id: "set2", name: "Other", items: [{ product_id: "p1", variant_ids: ["s"], count: 1 }] };
  const sets = [set, other, { ...set, _id: "gone", archived: true }];

  it("deleting a product deletes every live set holding it", () => {
    expect(deleteImpact(sets, { productIds: ["p1"] }).deleted.map((s) => s._id)).toEqual(["set1", "set2"]);
  });

  it("deleting a variant deletes a set only when an item had no other variant", () => {
    const impact = deleteImpact(sets, { variantId: "s" });
    expect(impact.deleted.map((s) => s._id)).toEqual(["set2"]);
    expect(impact.shrunk.map((s) => s._id)).toEqual(["set1"]);
  });
});
