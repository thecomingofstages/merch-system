import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentQR } from "./PaymentQR";

describe("PaymentQR", () => {
  it("renders a labelled SVG QR and the amount", () => {
    const html = renderToStaticMarkup(createElement(PaymentQR, { promptpayId: "0812345678", amount: 1270 }));
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="PromptPay QR"/);
    expect(html).toContain("฿1,270");
  });

  it("throws on an ID that isn't a PromptPay ID, so no wrong QR is shown", () => {
    expect(() => renderToStaticMarkup(createElement(PaymentQR, { promptpayId: "12345", amount: 1 }))).toThrow();
  });
});
