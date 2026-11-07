import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
const { sendOrderConfirmation, sendShippingUpdate } = await import("../src/app/helpers/email.helper");

const config = { RESEND_API_KEY: "k", EMAIL_FROM: "Shop <shop@example.test>" };
const order = {
  _id: "6ae813798c7f84d1ab3f8beb",
  recipient: { first_name: "<b>Ann</b>", email: "buyer@example.com" },
  products: [{ product_name: "Shirt", variants: [{ variant_name: "M", count: 2, unit_price: 250 }] }],
  original_price: 500,
  shipping_fee: 60,
  shipping_address: { details: "1 Road", tambon: "T", amphoe: "A", province: "P", postal_code: "10200" },
  tracking_id: "TH123",
};

describe("email.helper (2.5)", () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ data: { id: "e1" }, error: null });
  });

  it("sends the confirmation to the buyer with items, total and the Thai address", async () => {
    await sendOrderConfirmation(order, config);
    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0]![0];
    expect(mail).toMatchObject({ from: config.EMAIL_FROM, to: "buyer@example.com" });
    expect(mail.text).toContain("Shirt (M) × 2: 500 ฿");
    expect(mail.text).toContain("560 ฿");
    expect(mail.text).toContain("ตำบลT อำเภอA จังหวัดP 10200");
  });

  it("sends the shipping update with the tracking ID", async () => {
    await sendShippingUpdate(order, config);
    expect(send.mock.calls[0]![0].text).toContain("TH123");
  });

  it("escapes buyer text in the HTML", async () => {
    await sendOrderConfirmation(order, config);
    const { html } = send.mock.calls[0]![0];
    expect(html).toContain("&lt;b&gt;Ann&lt;/b&gt;");
    expect(html).not.toContain("<b>Ann</b>");
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
