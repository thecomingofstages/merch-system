import { describe, expect, it } from "vitest";
import { crc16, promptpayPayload } from "./promptpay";

describe("crc16", () => {
  it("matches the CRC-16/CCITT-FALSE check value", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

// Field order and formats follow the promptpay-qr reference (github.com/dtinth/promptpay-qr).
describe("promptpayPayload", () => {
  const merchant = (target: string) => `29${String(20 + target.length).padStart(2, "0")}0016A000000677010111${target}`;
  const expected = (target: string, amount: string) => {
    const body = `000201010212${merchant(target)}5802TH5303764${amount}6304`;
    return body + crc16(body);
  };

  it("phone number: 0 becomes 66, padded to 13 digits", () => {
    expect(promptpayPayload("081-234-5678", 270)).toBe(expected("01130066812345678", "5406270.00"));
  });

  it("national or tax ID", () => {
    expect(promptpayPayload("1234567890123", 1)).toBe(expected("02131234567890123", "54041.00"));
  });

  it("e-wallet ID", () => {
    expect(promptpayPayload("123456789012345", 99999)).toBe(expected("0315123456789012345", "540899999.00"));
  });

  it("ends with the CRC of everything before it", () => {
    const payload = promptpayPayload("0812345678", 270);
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it.each([["12345"], ["081234567"], ["1812345678"], ["abc"], [""]])("rejects the ID %j", (id) => {
    expect(() => promptpayPayload(id, 270)).toThrow();
  });

  it.each([[0], [-1], [1.5], [Number.NaN]])("rejects the amount %j", (amount) => {
    expect(() => promptpayPayload("0812345678", amount)).toThrow();
  });
});
