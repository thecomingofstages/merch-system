/**
 * Emails to the buyer (2.5, S10), sent through Resend (docs/BACKEND.md "Emails").
 * Called after the database write succeeds. A failed send is logged and never thrown,
 * so it can't fail or roll back an order. No tracking link yet: the provider is still open.
 */
import { formatThaiAddress, shortOrderId, type Address } from "@merch/shared";
import { Resend } from "resend";
import { EMAIL_LOGO_PNG_BASE64 } from "../assets/emailLogo";
import type { Config } from "../config/init";
import type { Models } from "../models";

export type EmailConfig = Pick<Config, "RESEND_API_KEY" | "EMAIL_FROM">;

type Id = { toString(): string };
/** The parts of a purchase an email shows. A purchase document from the database fits. */
export type EmailOrder = {
  _id: unknown;
  recipient?: { first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null } | null;
  products: { products_id?: Id; product_name: string; variants: { variants_id?: Id; variant_name: string; count: number; unit_price: number }[] }[];
  promotions?: {
    promotion_name: string;
    price: number;
    variants: { products_id?: Id; product_name: string; variants_id?: Id; variant_name: string; count: number }[];
  }[];
  original_price: number;
  shipping_fee: number;
  shipping_address?: { [K in keyof Address]?: string | null } | null;
  tracking_id?: string | null;
};

const SENDER = "TCOS Merchandise";

/** Every word the buyer reads (Thai only, like the shop). */
export const emailCopy = {
  confirmationSubject: (no: string) => `ยืนยันคำสั่งซื้อ : Order ${no}`,
  shippingSubject: (no: string) => `สินค้าอยู่ระหว่างการจัดส่ง : Order ${no}`,
  confirmationHeadline: (name: string) => `คุณ ${name} เราได้รับคำสั่งซื้อแล้ว`,
  shippingHeadline: (name: string) => `คุณ ${name} คำสั่งซื้ออยู่ระหว่างการจัดส่ง`,
  confirmationNote: "ทีมงานจะตรวจยอดเงินกับบัญชีธนาคาร แล้วส่งอีเมลแจ้งเลขพัสดุเมื่อส่งของ",
  shippingNote: "ใช้เลขพัสดุนี้ติดตามพัสดุกับบริษัทขนส่ง",
  orderNo: "หมายเลขคำสั่งซื้อ",
  trackingId: "เลขพัสดุ",
  items: "รายการสินค้า",
  product: "สินค้า",
  count: "จำนวน",
  price: "ราคา",
  set: "เซ็ตโปรโมชัน",
  subtotal: "ราคาสินค้า",
  shipping: "ค่าส่ง",
  total: "ยอดรวม",
  address: "ที่อยู่จัดส่ง",
  footer: "อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ",
};

// The shop's design tokens (packages/ui/src/styles.css). An email can't read CSS variables and
// most mail apps drop <style>, so the values are copied here and set inline. Keep them in step.
const C = {
  sunk: "#0e0e0c",
  canvas: "#131311",
  surface: "#1b1b19",
  raised: "#2a2a27",
  line: "#3a3833",
  fg: "#f4f0ea",
  fg2: "#bdb6a9",
  fg3: "#8f897e",
  gold: "#d8b85a",
};
const FONT = "'Sarabun','Prompt',Tahoma,'Leelawadee UI',sans-serif";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const isComplete = (a: EmailOrder["shipping_address"]): a is Address =>
  !!a && !!a.details && !!a.tambon && !!a.amphoe && !!a.province && !!a.postal_code;

const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;
const fullName = (r: EmailOrder["recipient"]) => [r?.first_name, r?.last_name].filter(Boolean).join(" ");

/** Picture per variant id: the variant's own, else its product's first. Archived ones count too. */
export type ItemImages = Map<string, string>;

/** Reads the pictures when the email goes out; a failed read sends the email without them. */
export async function itemImages(m: Models, order: EmailOrder): Promise<ItemImages> {
  const ids = [
    ...order.products.map((p) => p.products_id),
    ...(order.promotions ?? []).flatMap((s) => s.variants.map((v) => v.products_id)),
  ].filter((id): id is Id => !!id);
  const images: ItemImages = new Map();
  try {
    const products = await m.Product.find({ _id: { $in: ids } }, { image: 1, variants: 1 }).lean();
    for (const p of products) {
      for (const v of p.variants) {
        const url = v.image || p.image[0];
        if (url) images.set(String(v._id), url);
      }
    }
  } catch (err) {
    console.error("Email pictures not read", { orderId: String(order._id), name: (err as Error)?.name });
  }
  return images;
}

/** One item row: picture, name and variant, count, price (blank for the pieces of a set). */
function itemRow(image: string | undefined, name: string, variant: string, count: number, price: string, indent = false) {
  const pic = image
    ? // Width only: Gmail and Outlook ignore object-fit, so a fixed height would squash a non-square photo.
      `<img src="${escape(image)}" width="56" alt="" style="display:block;width:56px;height:auto;border-radius:4px;background:${C.raised}">`
    : `<div style="width:56px;height:56px;border-radius:4px;background:${C.raised}"></div>`;
  return `<tr>
  <td style="padding:10px 0 10px ${indent ? 16 : 0}px;width:56px;vertical-align:top">${pic}</td>
  <td style="padding:10px 12px;vertical-align:top;color:${C.fg};font-size:15px;line-height:1.5">${escape(name)}<br><span style="color:${C.fg2};font-size:14px">${escape(variant)}</span></td>
  <td style="padding:10px 0;vertical-align:top;color:${C.fg2};font-size:15px;text-align:center;white-space:nowrap">×${count}</td>
  <td style="padding:10px 0 10px 12px;vertical-align:top;color:${C.fg};font-size:15px;text-align:right;white-space:nowrap">${price}</td>
</tr>`;
}

const total = (o: EmailOrder) => o.original_price + o.shipping_fee;

/** The message as HTML (the shop's dark look, in tables for mail apps) and as plain text. */
export function renderEmail(order: EmailOrder, kind: "confirmation" | "shipping", images: ItemImages = new Map()) {
  const no = shortOrderId(String(order._id));
  const name = fullName(order.recipient);
  const headline = kind === "confirmation" ? emailCopy.confirmationHeadline(name) : emailCopy.shippingHeadline(name);
  const note = kind === "confirmation" ? emailCopy.confirmationNote : emailCopy.shippingNote;
  const img = (id?: Id) => (id ? images.get(String(id)) : undefined);

  const rows = [
    ...order.products.flatMap((p) =>
      p.variants.map((v) => itemRow(img(v.variants_id), p.product_name, v.variant_name, v.count, baht(v.unit_price * v.count))),
    ),
    // A set (D13): its own price on its row, then the pieces chosen, without prices.
    ...(order.promotions ?? []).flatMap((s) => [
      `<tr><td colspan="3" style="padding:12px 0 2px;color:${C.gold};font-size:14px">${escape(emailCopy.set)} · <span style="color:${C.fg}">${escape(s.promotion_name)}</span></td><td style="padding:12px 0 2px 12px;color:${C.fg};font-size:15px;text-align:right">${baht(s.price)}</td></tr>`,
      ...s.variants.map((v) => itemRow(img(v.variants_id), v.product_name, v.variant_name, v.count, "", true)),
    ]),
  ].join("\n");

  const sum = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;color:${strong ? C.fg : C.fg2};font-size:${strong ? 17 : 15}px;${strong ? "font-weight:600;" : ""}">${escape(label)}</td><td style="padding:4px 0;text-align:right;color:${C.fg};font-size:${strong ? 17 : 15}px;${strong ? "font-weight:600;" : ""}">${value}</td></tr>`;

  const address = isComplete(order.shipping_address)
    ? `<p style="margin:0 0 4px;color:${C.fg3};font-size:13px">${escape(emailCopy.address)}</p>
<p style="margin:0;color:${C.fg};font-size:15px;line-height:1.6">${escape(name)}${order.recipient?.phone ? ` · ${escape(order.recipient.phone)}` : ""}<br>${escape(formatThaiAddress(order.shipping_address))}</p>`
    : "";

  const tracking =
    kind === "shipping" && order.tracking_id
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${C.gold};border-radius:8px"><tr><td style="padding:14px 16px">
<p style="margin:0;color:${C.fg3};font-size:13px">${escape(emailCopy.trackingId)}</p>
<p style="margin:2px 0 0;color:${C.gold};font-size:20px;font-weight:600;letter-spacing:0.5px">${escape(order.tracking_id)}</p></td></tr></table>`
      : "";

  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(no)}</title></head>
<body style="margin:0;padding:0;background:${C.sunk};font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sunk}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.canvas};border:1px solid ${C.line};border-radius:12px">
<tr><td style="padding:20px 24px;border-bottom:1px solid ${C.line}">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle"><img src="cid:logo" width="64" alt="The Coming of Stages" style="display:block;width:64px;height:auto"></td>
    <td style="vertical-align:middle;padding-left:12px;color:${C.fg};font-size:20px;font-weight:600;font-family:'Prompt',${FONT}">Merch</td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 24px 8px">
  <h1 style="margin:0 0 8px;color:${C.fg};font-size:22px;line-height:1.4;font-weight:600;font-family:'Prompt',${FONT}">${escape(headline)}</h1>
  <p style="margin:0 0 4px;color:${C.fg2};font-size:15px">${escape(emailCopy.orderNo)} <span style="color:${C.gold};font-weight:600">${escape(no)}</span></p>
  <p style="margin:0 0 24px;color:${C.fg2};font-size:15px;line-height:1.6">${escape(note)}</p>
  ${tracking}
  <p style="margin:0 0 4px;color:${C.fg3};font-size:13px">${escape(emailCopy.items)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr><th align="left" colspan="2" style="padding:6px 0;border-bottom:1px solid ${C.line};color:${C.fg3};font-size:13px;font-weight:400">${escape(emailCopy.product)}</th><th style="padding:6px 0;border-bottom:1px solid ${C.line};color:${C.fg3};font-size:13px;font-weight:400">${escape(emailCopy.count)}</th><th align="right" style="padding:6px 0;border-bottom:1px solid ${C.line};color:${C.fg3};font-size:13px;font-weight:400">${escape(emailCopy.price)}</th></tr>
  ${rows}
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 24px;border-top:1px solid ${C.line};padding-top:8px">
  ${sum(emailCopy.subtotal, baht(order.original_price))}
  ${sum(emailCopy.shipping, baht(order.shipping_fee))}
  ${sum(emailCopy.total, baht(total(order)), true)}
  </table>
  ${address}
</td></tr>
<tr><td style="padding:24px;border-top:1px solid ${C.line};color:${C.fg3};font-size:12px;line-height:1.6">${escape(emailCopy.footer)}<br>${SENDER} · The Coming of Stages (เด็กไทยติดเวที)</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const lines = [
    ...order.products.flatMap((p) => p.variants.map((v) => `- ${p.product_name} (${v.variant_name}) ×${v.count}  ${baht(v.unit_price * v.count)}`)),
    ...(order.promotions ?? []).flatMap((s) => [
      `- ${emailCopy.set} ${s.promotion_name}  ${baht(s.price)}`,
      ...s.variants.map((v) => `    ${v.product_name} (${v.variant_name}) ×${v.count}`),
    ]),
  ];
  const text = [
    headline,
    `${emailCopy.orderNo} ${no}`,
    note,
    ...(kind === "shipping" && order.tracking_id ? ["", `${emailCopy.trackingId}: ${order.tracking_id}`] : []),
    "",
    `${emailCopy.items}:`,
    ...lines,
    "",
    `${emailCopy.subtotal}: ${baht(order.original_price)}`,
    `${emailCopy.shipping}: ${baht(order.shipping_fee)}`,
    `${emailCopy.total}: ${baht(total(order))}`,
    ...(isComplete(order.shipping_address) ? ["", `${emailCopy.address}: ${formatThaiAddress(order.shipping_address)}`] : []),
    "",
    emailCopy.footer,
  ].join("\n");
  return { subject: kind === "confirmation" ? emailCopy.confirmationSubject(no) : emailCopy.shippingSubject(no), html, text };
}

/** "TCOS Merchandise <address>", unless EMAIL_FROM already names its sender. */
export const fromHeader = (emailFrom: string) => (emailFrom.includes("<") ? emailFrom : `${SENDER} <${emailFrom.trim()}>`);

async function send(config: EmailConfig, kind: "confirmation" | "shipping", order: EmailOrder, images: ItemImages) {
  const to = order.recipient?.email;
  const orderId = String(order._id);
  if (!to) {
    console.error("Email not sent: no recipient", { kind, orderId });
    return;
  }
  try {
    const { subject, html, text } = renderEmail(order, kind, images);
    const { error } = await new Resend(config.RESEND_API_KEY).emails.send({
      from: fromHeader(config.EMAIL_FROM),
      to,
      subject,
      html,
      text,
      // The logo, shown by <img src="cid:logo">: inside the email, as no public address is known.
      attachments: [{ filename: "logo.png", content: EMAIL_LOGO_PNG_BASE64, contentType: "image/png", contentId: "logo" }],
    });
    // The address is personal data: log the order, never the email.
    if (error) console.error("Email not sent", { kind, orderId, name: error.name, message: error.message });
  } catch (err) {
    console.error("Email not sent", { kind, orderId, name: (err as Error)?.name });
  }
}

/** After an online order is saved (S5): items with pictures, totals and address. */
export async function sendOrderConfirmation(order: EmailOrder, config: EmailConfig, m?: Models) {
  await send(config, "confirmation", order, m ? await itemImages(m, order) : new Map());
}

/** After a tracking ID is saved (S7). */
export async function sendShippingUpdate(order: EmailOrder, config: EmailConfig, m?: Models) {
  await send(config, "shipping", order, m ? await itemImages(m, order) : new Map());
}
