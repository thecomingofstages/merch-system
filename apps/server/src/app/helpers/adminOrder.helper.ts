/**
 * The orders back office (S7). Lists and counts are online orders only: POS sales never
 * ship, so they would sit in the new-order badge forever. For the same reason, rejected
 * orders (still ORDERED) are left out unless asked for with payment_status=REJECTED.
 */
import type { AdminOrdersCountQuery, AdminOrdersQuery, AdminOrdersResponse, VerifyPaymentStatus } from "@merch/shared";
import type { Connection, Types } from "mongoose";
import { appConf } from "../config/app.conf";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";
import { type EmailConfig, sendShippingUpdate } from "./email.helper";
import { returnOnlineStock } from "./stock.helper";

type Id = Types.ObjectId;

const onlineOrders = (q: AdminOrdersCountQuery) => ({
  pos_id: null,
  ...(q.status && { status: q.status }),
  payment_status: q.payment_status ?? { $ne: "REJECTED" as const },
});

export async function listOrders(m: Models, q: AdminOrdersQuery) {
  const page = q.page ?? 1;
  const page_size = appConf.ordersPageSize;
  const [orders, total] = await Promise.all([
    m.Purchase.find(onlineOrders(q))
      .sort({ created_at: -1 })
      .skip((page - 1) * page_size)
      .limit(page_size)
      .lean(),
    m.Purchase.countDocuments(onlineOrders(q)),
  ]);
  return { orders, total, page, page_size } as unknown as AdminOrdersResponse;
}

export const countOrders = async (m: Models, q: AdminOrdersCountQuery) => ({
  count: await m.Purchase.countDocuments(onlineOrders(q)),
});

export async function getOrder(m: Models, id: Id) {
  const order = await m.Purchase.findById(id).lean();
  if (!order) throw ApiError.notFound("Order not found");
  return order;
}

/**
 * Only a PENDING_CHECK order can be decided, once. The filter is the guard: two admins
 * rejecting at once can't return the stock twice. Rejecting returns it in one transaction.
 */
export async function setPayment(m: Models, db: Connection, id: Id, payment_status: VerifyPaymentStatus) {
  return db.transaction(async (session) => {
    const order = await m.Purchase.findOneAndUpdate(
      { _id: id, pos_id: null, payment_status: "PENDING_CHECK" },
      { $set: { payment_status, ...(payment_status === "VERIFIED" && { verified_at: new Date() }) } },
      { new: true, session },
    ).lean();
    if (!order) {
      const exists = await m.Purchase.findById(id).session(session).lean();
      if (!exists) throw ApiError.notFound("Order not found");
      if (exists.pos_id) throw ApiError.validation("A POS sale has no payment check");
      throw ApiError.conflict("NOT_PENDING", `This order is already ${exists.payment_status}`);
    }
    if (payment_status === "REJECTED") await returnOnlineStock(m, order.products, session);
    return order;
  });
}

/**
 * Saving a tracking ID sends the order: status SHIPPING. Verified online orders only.
 * Each save emails the buyer once (S10), so a corrected ID reaches them too.
 */
export async function setTracking(m: Models, id: Id, tracking_id: string, config: EmailConfig) {
  const order = await m.Purchase.findOneAndUpdate(
    { _id: id, pos_id: null, payment_status: "VERIFIED" },
    { $set: { tracking_id, status: "SHIPPING" } },
    { new: true },
  ).lean();
  if (order) {
    await sendShippingUpdate(order, config);
    return order;
  }
  const exists = await m.Purchase.findById(id).lean();
  if (!exists) throw ApiError.notFound("Order not found");
  if (exists.pos_id) throw ApiError.validation("A POS sale can't get a tracking ID");
  throw ApiError.conflict("NOT_VERIFIED", "Verify the payment before shipping");
}
