/**
 * Online orders (S5). One transaction: price from the database, take the stock, save
 * the order. If any step fails, nothing is kept (docs/BACKEND.md "Business rules").
 */
import type { CreateOrderRequest, CreateOrderResponse, QuoteLine } from "@merch/shared";
import type { Connection } from "mongoose";
import type { z } from "zod";
import type { Config } from "../config/init";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";
import { priceCart } from "./pricing.helper";
import { deductOnlineStock } from "./stock.helper";

type Order = z.output<typeof CreateOrderRequest>;

export async function createOrder(
  m: Models,
  db: Connection,
  body: Order,
  config: Pick<Config, "SHIPPING_FEE">,
): Promise<CreateOrderResponse> {
  const session = await db.startSession();
  try {
    // withTransaction retries the whole callback on a write conflict, so when two
    // orders race for the last item the loser re-runs, finds no stock, and gets 409.
    return await session.withTransaction(async () => {
      const priced = await priceCart(m, { channel: "ONLINE", items: body.items }, config, session);
      await deductOnlineStock(m, priced.lines, session);
      const [order] = await m.Purchase.create(
        [
          {
            users: null, // TODO(S6): the signed-in buyer
            products: groupByProduct(priced.lines),
            original_price: priced.subtotal,
            shipping_fee: priced.shipping_fee,
            recipient: body.recipient,
            shipping_address: body.shipping_address,
            slip_qr_data: body.slip_qr_data,
            verify_method: "QR",
          },
        ],
        { session },
      );
      return {
        _id: String(order!._id),
        status: "ORDERED",
        payment_status: "PENDING_CHECK",
        subtotal: priced.subtotal,
        shipping_fee: priced.shipping_fee,
        total: priced.total,
        created_at: order!.created_at.toISOString(),
      };
    });
  } catch (err) {
    if (isDuplicateSlip(err)) throw ApiError.conflict("DUPLICATE_SLIP", "This slip has already been used for an order");
    throw err;
  } finally {
    await session.endSession();
  }
}

/** The order's `products` shape: one entry per product, its variants inside. */
function groupByProduct(lines: QuoteLine[]) {
  const products = new Map<string, { products_id: string; product_name: string; variants: object[] }>();
  for (const l of lines) {
    const p = products.get(l.product_id) ?? { products_id: l.product_id, product_name: l.product_name, variants: [] };
    p.variants.push({ variants_id: l.variant_id, variant_name: l.variant_name, count: l.count, unit_price: l.unit_price });
    products.set(l.product_id, p);
  }
  return [...products.values()];
}

const isDuplicateSlip = (err: unknown) =>
  (err as { code?: number })?.code === 11000 && "slip_qr_data" in ((err as { keyPattern?: object }).keyPattern ?? {});
