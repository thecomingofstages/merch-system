import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SlipQrCode } from "./SlipQrCode";

describe("SlipQrCode", () => {
  it("draws a labelled QR, also for a payload with edge spaces", () => {
    const html = renderToStaticMarkup(createElement(SlipQrCode, { data: " 0046000600000101030140225 ", label: "Slip QR" }));
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Slip QR"/);
  });
});
