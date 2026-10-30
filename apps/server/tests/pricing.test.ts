import { describe, expect, it } from "vitest";
import { mergeLines } from "../src/app/helpers/pricing.helper";

const p = "a".repeat(24);
const v1 = "b".repeat(24);
const v2 = "c".repeat(24);

describe("mergeLines", () => {
  it("adds up lines for the same variant, so splitting can't get around buy_limit", () => {
    expect(
      mergeLines([
        { product_id: p, variant_id: v1, count: 2 },
        { product_id: p, variant_id: v2, count: 1 },
        { product_id: p.toUpperCase(), variant_id: v1.toUpperCase(), count: 3 },
      ]),
    ).toEqual([
      { product_id: p, variant_id: v1, count: 5 },
      { product_id: p, variant_id: v2, count: 1 },
    ]);
  });
});
