/**
 * Emails to the buyer (2.5, S10), sent through Resend (docs/BACKEND.md "Emails").
 * Called after the database write succeeds. A failed send is logged and never thrown,
 * so it can't fail or roll back an order. No tracking link yet: the provider is still open.
 */
import { formatThaiAddress, type Address } from "@merch/shared";
import { Resend } from "resend";
import type { Config } from "../config/init";

export type EmailConfig = Pick<Config, "RESEND_API_KEY" | "EMAIL_FROM">;

/** The parts of a purchase an email shows. A purchase document from the database fits. */
export type EmailOrder = {
  _id: unknown;
  recipient?: { first_name?: string | null; email?: string | null } | null;
  products: { product_name: string; variants: { variant_name: string; count: number; unit_price: number }[] }[];
  original_price: number;
  shipping_fee: number;
  shipping_address?: { [K in keyof Address]?: string | null } | null;
  tracking_id?: string | null;
};

/**
 * TODO(email copy): every word the buyer reads is here, as plain placeholders. No email
 * wording is in docs/FRONTEND.md "Copy" yet; replace these with the approved Thai text.
 */
export const emailCopy = {
  confirmationSubject: (orderId: string) => `Order ${orderId}`,
  shippingSubject: (orderId: string) => `Order ${orderId}: shipped`,
  greeting: (name: string) => `${name},`,
  confirmationIntro: "Order received.",
  shippingIntro: "Your order has shipped.",
  items: "Items",
  subtotal: "Subtotal",
  shipping: "Shipping",
  total: "Total",
  address: "Shipping address",
  trackingId: "Tracking ID",
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const isComplete = (a: EmailOrder["shipping_address"]): a is Address =>
  !!a && !!a.details && !!a.tambon && !!a.amphoe && !!a.province && !!a.postal_code;

const baht = (n: number) => `${n.toLocaleString("en-US")} ฿`;

/** One message as plain text and as HTML, built from the same lines. */
function render(order: EmailOrder, intro: string, extra: [string, string][] = []) {
  const items = order.products.flatMap((p) =>
    p.variants.map((v) => `${p.product_name} (${v.variant_name}) × ${v.count}: ${baht(v.unit_price * v.count)}`),
  );
  const rows: [string, string][] = [
    [emailCopy.subtotal, baht(order.original_price)],
    [emailCopy.shipping, baht(order.shipping_fee)],
    [emailCopy.total, baht(order.original_price + order.shipping_fee)],
    ...(isComplete(order.shipping_address) ? ([[emailCopy.address, formatThaiAddress(order.shipping_address)]] as [string, string][]) : []),
    ...extra,
  ];
  const head = [emailCopy.greeting(order.recipient?.first_name ?? ""), intro];

  const text = [...head, "", `${emailCopy.items}:`, ...items.map((i) => `- ${i}`), "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = [
    ...head.map((l) => `<p>${escape(l)}</p>`),
    `<p><strong>${escape(emailCopy.items)}</strong></p>`,
    `<ul>${items.map((i) => `<li>${escape(i)}</li>`).join("")}</ul>`,
    `<table>${rows.map(([k, v]) => `<tr><th align="left">${escape(k)}</th><td>${escape(v)}</td></tr>`).join("")}</table>`,
  ].join("\n");
  return { text, html };
}

async function send(config: EmailConfig, kind: string, order: EmailOrder, subject: string, body: { text: string; html: string }) {
  const to = order.recipient?.email;
  const orderId = String(order._id);
  if (!to) {
    console.error("Email not sent: no recipient", { kind, orderId });
    return;
  }
  try {
    const { error } = await new Resend(config.RESEND_API_KEY).emails.send({ from: config.EMAIL_FROM, to, subject, ...body });
    // The address is personal data: log the order, never the email.
    if (error) console.error("Email not sent", { kind, orderId, name: error.name, message: error.message });
  } catch (err) {
    console.error("Email not sent", { kind, orderId, name: (err as Error)?.name });
  }
}

/** After an online order is saved (S5): items, totals and address. */
export async function sendOrderConfirmation(order: EmailOrder, config: EmailConfig) {
  const id = String(order._id);
  await send(config, "order_confirmation", order, emailCopy.confirmationSubject(id), render(order, emailCopy.confirmationIntro));
}

/** After a tracking ID is saved (S7). */
export async function sendShippingUpdate(order: EmailOrder, config: EmailConfig) {
  const id = String(order._id);
  const tracking: [string, string][] = [[emailCopy.trackingId, order.tracking_id ?? ""]];
  await send(config, "shipping_update", order, emailCopy.shippingSubject(id), render(order, emailCopy.shippingIntro, tracking));
}
