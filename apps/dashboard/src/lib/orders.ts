import type { Purchase } from "@merch/shared";
import { COPY } from "@/app/(admin)/orders/copy";
import { handleUnauthorized } from "@/components/AuthGuard";
import { ApiError } from "@/lib/api";

/**
 * True when the purchase record comes from an on-site POS sale rather than the online shop.
 */
export function isPosSale(order: Purchase): boolean {
  return order.pos_id !== null || order.users === null;
}

/**
 * True only for online orders that are still waiting for an admin slip check.
 */
export function canCheckPayment(order: Purchase): boolean {
  return !isPosSale(order) && order.payment_status === "PENDING_CHECK";
}

// TODO(D10): if CEO rejects D10 (question 21), relax or remove the payment_status === "VERIFIED" check here.
/**
 * True when an admin can enter a tracking ID to ship the order:
 * online order, payment verified, and status is still ORDERED.
 */
export function canSetTracking(order: Purchase): boolean {
  return (
    !isPosSale(order) &&
    order.payment_status === "VERIFIED" &&
    order.status === "ORDERED"
  );
}

// TODO(ask BE): return total in the order response
/**
 * Computes the display total from the two server-stored amounts on the purchase record.
 * Never recomputes from catalog prices or line items.
 */
export function orderTotal(order: Pick<Purchase, "original_price" | "shipping_fee">): number {
  return order.original_price + order.shipping_fee;
}

/**
 * Total item count across all product variant lines in an order.
 */
export function orderItemCount(order: Pick<Purchase, "products">): number {
  return order.products.reduce(
    (sum, productLine) =>
      sum + productLine.variants.reduce((vSum, v) => vSum + v.count, 0),
    0,
  );
}

/**
 * Maps ApiError from order endpoints into user-facing copy, redirecting to /sign-in on 401.
 */
export function mapOrderError(
  err: unknown,
  onRedirect: (path: string) => void,
): string | null {
  if (handleUnauthorized(err, onRedirect)) {
    return null;
  }
  if (err instanceof ApiError) {
    switch (err.code) {
      case "NOT_VERIFIED":
        return COPY.notVerifiedError;
      case "NOT_FOUND":
        return COPY.notFoundError;
      case "NETWORK":
        return COPY.networkError;
      default:
        return err.message || COPY.networkError;
    }
  }
  return COPY.networkError;
}

const bangkokDateFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatBangkokDateTime(iso: string): string {
  try {
    return bangkokDateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatBuyerSummary(
  order: Pick<Purchase, "pos_id" | "users" | "recipient">,
): string {
  if (isPosSale(order as Purchase)) {
    return COPY.channelPos;
  }
  if (!order.recipient) {
    return COPY.noValue;
  }
  return `${order.recipient.first_name} ${order.recipient.last_name} (${order.recipient.nickname})`;
}

export function shortOrderId(id: string): string {
  return id.length > 8 ? `#${id.slice(-6).toUpperCase()}` : `#${id}`;
}
