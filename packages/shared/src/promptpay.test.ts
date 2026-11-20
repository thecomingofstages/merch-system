import { describe, expect, it } from "vitest";
import { isPromptpayId } from "./promptpay";

describe("isPromptpayId", () => {
  it("takes a phone number, a 13-digit ID or a 15-digit e-wallet ID, ignoring spaces and dashes", () => {
    for (const id of ["0812345678", "081-234-5678", "1234567890123", "123456789012345"]) expect(isPromptpayId(id)).toBe(true);
  });

  it("refuses anything else", () => {
    for (const id of ["+66812345678", "081234567", "1812345678", "abc", ""]) expect(isPromptpayId(id)).toBe(false);
  });
});
