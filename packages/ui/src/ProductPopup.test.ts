import { describe, expect, it } from "vitest";
import { maxCount } from "./ProductPopup";

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
