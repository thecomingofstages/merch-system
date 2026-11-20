import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentQR } from "./PaymentQR";

describe("PaymentQR", () => {
  it("shows promptpay.io's QR for the ID and amount, the amount, and the account it pays", () => {
    const html = renderToStaticMarkup(createElement(PaymentQR, { promptpayId: "081-234-5678", name: "Shop account", amount: 1270 }));
    expect(html).toMatch(/<img[^>]*src="https:\/\/promptpay\.io\/0812345678\/1270\.png"[^>]*alt="PromptPay QR"[^>]*referrerPolicy="no-referrer"/);
    expect(html).toContain("฿1,270");
    expect(html).toContain("Shop account · 0812345678");
  });

  it("throws on an ID that isn't a PromptPay ID or an amount that isn't whole baht above 0, so no wrong QR is shown", () => {
    const render = (promptpayId: string, amount: number) =>
      renderToStaticMarkup(createElement(PaymentQR, { promptpayId, name: "x", amount }));
    expect(() => render("12345", 1)).toThrow();
    expect(() => render("0812345678", 0)).toThrow();
    expect(() => render("0812345678", 1.5)).toThrow();
  });
});
