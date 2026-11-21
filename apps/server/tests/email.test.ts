import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
const { fromHeader, itemImages, renderEmail, sendOrderConfirmation, sendShippingUpdate } = await import("../src/app/helpers/email.helper");

const config = { RESEND_API_KEY: "k", EMAIL_FROM: "shop@example.test" };
const shirt = "64b000000000000000000001";
const shirtM = "64b0000000000000000000a1";
const cap = "64b000000000000000000002";
const capRed = "64b0000000000000000000b1";
const order = {
  _id: "6ae813798c7f84d1ab3f8beb",
  recipient: { first_name: "<b>Ann</b>", last_name: "Lee", phone: "0812345678", email: "buyer@example.com" },
  products: [{ products_id: shirt, product_name: "Shirt", variants: [{ variants_id: shirtM, variant_name: "M", count: 2, unit_price: 250 }] }],
  promotions: [{ promotion_name: "Set A", price: 599, variants: [{ products_id: cap, product_name: "Cap", variants_id: capRed, variant_name: "Red", count: 1 }] }],
  original_price: 1099,
  shipping_fee: 60,
  shipping_address: { details: "1 Road", tambon: "T", amphoe: "A", province: "P", postal_code: "10200" },
  tracking_id: "TH123",
};

describe("email.helper (2.5)", () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ data: { id: "e1" }, error: null });
  });

  it("sends the confirmation from TCOS Merchandise, with the order code in the subject and the logo inside", async () => {
    await sendOrderConfirmation(order, config);
    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0]![0];
    expect(mail).toMatchObject({ from: "TCOS Merchandise <shop@example.test>", to: "buyer@example.com", subject: "ยืนยันคำสั่งซื้อ : Order #3F8BEB" });
    expect(mail.attachments).toEqual([expect.objectContaining({ contentId: "logo", contentType: "image/png" })]);
    expect(mail.html).toContain('src="cid:logo"');
    expect(mail.text.split("\n")[0]).toBe("คุณ <b>Ann</b> Lee เราได้รับคำสั่งซื้อแล้ว");
    expect(mail.text).toContain("Shirt (M) ×2  ฿500");
    expect(mail.text).toContain("ยอดรวม: ฿1,159");
    expect(mail.text).toContain("ตำบลT อำเภอA จังหวัดP 10200");
  });

  it("keeps a sender name EMAIL_FROM already has", () => {
    expect(fromHeader("Shop <shop@example.test>")).toBe("Shop <shop@example.test>");
    expect(fromHeader(" no-reply@example.test ")).toBe("TCOS Merchandise <no-reply@example.test>");
  });

  it("sends the shipping update with its own first line, subject and the tracking ID", async () => {
    await sendShippingUpdate(order, config);
    const mail = send.mock.calls[0]![0];
    expect(mail.subject).toBe("สินค้าอยู่ระหว่างการจัดส่ง : Order #3F8BEB");
    expect(mail.text.split("\n")[0]).toBe("คุณ <b>Ann</b> Lee คำสั่งซื้ออยู่ระหว่างการจัดส่ง");
    expect(mail.html).toContain("TH123");
  });

  it("escapes buyer text in the HTML", async () => {
    await sendOrderConfirmation(order, config);
    const { html } = send.mock.calls[0]![0];
    expect(html).toContain("&lt;b&gt;Ann&lt;/b&gt; Lee");
    expect(html).not.toContain("<b>Ann</b>");
  });

  it("puts each variant's picture in its row: its own, else its product's first; sets' pieces too", async () => {
    const products = [
      { _id: shirt, image: ["https://img.example/shirt.webp"], variants: [{ _id: shirtM, image: null }] },
      { _id: cap, image: ["https://img.example/cap.webp"], variants: [{ _id: capRed, image: "https://img.example/cap-red.webp" }] },
    ];
    const m = { Product: { find: vi.fn(() => ({ lean: async () => products })) } } as never;
    const images = await itemImages(m, order);
    expect([...images]).toEqual([
      [shirtM, "https://img.example/shirt.webp"],
      [capRed, "https://img.example/cap-red.webp"],
    ]);
    const { html } = renderEmail(order, "confirmation", images);
    expect(html.indexOf("shirt.webp")).toBeLessThan(html.indexOf(">Shirt<"));
    expect(html.indexOf("cap-red.webp")).toBeLessThan(html.indexOf(">Cap<"));
  });

  it("sends without pictures when they can't be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = { Product: { find: () => ({ lean: async () => { throw new Error("db down"); } }) } } as never;
    await sendOrderConfirmation(order, config, m);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].html).not.toContain("img.example");
    log.mockRestore();
  });

  it("logs a failed send without throwing, and never logs the address", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "bad from" } });
    await expect(sendOrderConfirmation(order, config)).resolves.toBeUndefined();
    send.mockRejectedValueOnce(new Error("network down"));
    await expect(sendShippingUpdate(order, config)).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("buyer@example.com");
    expect(JSON.stringify(log.mock.calls)).toContain(order._id);
    log.mockRestore();
  });

  it("skips an order with no recipient email, and says so", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendOrderConfirmation({ ...order, recipient: null }, config);
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
