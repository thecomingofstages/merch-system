/**
 * POS management (S8) and POS sales (S9). Every stock move is one transaction with its
 * stock_log entry (docs/BACKEND.md "Business rules" 8), so online plus every POS stays constant.
 */
import type { CreatePosRequest, CreatePosSaleRequest, CreatePosSaleResponse, TransferRequest } from "@merch/shared";
import type { Connection, Types } from "mongoose";
import type { Config } from "../config/init";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";
import { groupByProduct, isDuplicateSlip } from "./order.helper";
import { priceCart } from "./pricing.helper";
import { deductOnlineStock, deductPosStock, returnOnlineStock } from "./stock.helper";

type Id = Types.ObjectId;

export const listPos = (m: Models) => m.Pos.find({}, { stock_log: 0 }).sort({ name: 1 }).lean();

export async function getPos(m: Models, id: Id) {
  const pos = await m.Pos.findById(id).lean();
  if (!pos) throw ApiError.notFound("POS not found");
  return pos;
}

export async function createPos(m: Models, body: CreatePosRequest) {
  const shops = await m.Shop.countDocuments({ _id: { $in: body.shop_ids }, archived: false });
  if (shops !== new Set(body.shop_ids.map((s) => s.toLowerCase())).size) throw ApiError.validation("shop_ids: no such shop");
  return (await m.Pos.create(body)).toObject();
}

/** Moves stock from online to this POS. */
export async function transfer(m: Models, db: Connection, id: Id, body: TransferRequest) {
  const session = await db.startSession();
  try {
    return await session.withTransaction(async () => {
      const pos = await m.Pos.findById(id).session(session);
      if (!pos) throw ApiError.notFound("POS not found");
      const product = await m.Product.findOne({ _id: body.product_id, archived: false }).session(session).lean();
      const variant = product?.variants.find((v) => v._id.equals(body.variant_id) && !v.archived);
      if (!product || !variant) throw ApiError.validation("No such item");
      if (!pos.shop_ids.some((s) => s.equals(product.shop_id))) throw ApiError.validation("This POS doesn't sell that shop's items");

      await deductOnlineStock(
        m,
        [
          {
            product_id: body.product_id,
            product_name: product.name,
            variant_id: body.variant_id,
            variant_name: variant.name,
            count: body.amount,
            unit_price: variant.price,
          },
        ],
        session,
      );

      let line = pos.products.find((p) => p.product_id.equals(product._id));
      if (!line) {
        pos.products.push({ product_id: product._id, variants: [] });
        line = pos.products[pos.products.length - 1]!;
      }
      const held = line.variants.find((v) => v.variants_id.equals(variant._id));
      if (held) held.pos_stock += body.amount;
      else line.variants.push({ variants_id: variant._id, pos_stock: body.amount });
      pos.stock_log.push({ product_id: product._id, variant_id: variant._id, amount: body.amount, direction: "TO_POS", at: new Date() });
      await pos.save({ session });
      return pos.toObject();
    });
  } finally {
    await session.endSession();
  }
}

/** Ends the sale: everything left at this POS goes back online, and its stock table empties. */
export async function endSale(m: Models, db: Connection, id: Id) {
  const session = await db.startSession();
  try {
    return await session.withTransaction(async () => {
      const pos = await m.Pos.findById(id).session(session);
      if (!pos) throw ApiError.notFound("POS not found");
      for (const line of pos.products) {
        const left = line.variants.filter((v) => v.pos_stock > 0);
        if (left.length === 0) continue;
        await returnOnlineStock(
          m,
          [{ products_id: line.product_id, variants: left.map((v) => ({ variants_id: v.variants_id, count: v.pos_stock })) }],
          session,
        );
        for (const v of left) {
          pos.stock_log.push({ product_id: line.product_id, variant_id: v.variants_id, amount: v.pos_stock, direction: "TO_MAIN", at: new Date() });
        }
      }
      pos.set("products", []);
      await pos.save({ session });
      return pos.toObject();
    });
  } finally {
    await session.endSession();
  }
}

/** A sale at the POS: priced by the server, paid in front of staff, so VERIFIED when saved. */
export async function createSale(
  m: Models,
  db: Connection,
  id: Id,
  body: CreatePosSaleRequest,
  config: Pick<Config, "SHIPPING_FEE">,
): Promise<CreatePosSaleResponse> {
  const session = await db.startSession();
  try {
    return await session.withTransaction(async () => {
      const priced = await priceCart(m, { channel: "POS", pos_id: String(id), items: body.items }, config, session);
      await deductPosStock(m, id, priced.lines, session);
      const [sale] = await m.Purchase.create(
        [
          {
            users: null,
            products: groupByProduct(priced.lines),
            original_price: priced.subtotal,
            shipping_fee: priced.shipping_fee,
            // Left out for MANUAL, never null: see the slip index in purchase.model.ts.
            ...(body.verify_method === "QR" && { slip_qr_data: body.slip_qr_data }),
            verify_method: body.verify_method,
            payment_status: "VERIFIED",
            verified_at: new Date(),
            pos_id: id,
          },
        ],
        { session },
      );
      return {
        _id: String(sale!._id),
        verify_method: body.verify_method,
        payment_status: "VERIFIED",
        subtotal: priced.subtotal,
        shipping_fee: priced.shipping_fee,
        total: priced.total,
        created_at: sale!.created_at.toISOString(),
      };
    });
  } catch (err) {
    if (isDuplicateSlip(err)) throw ApiError.conflict("DUPLICATE_SLIP", "This slip has already been used");
    throw err;
  } finally {
    await session.endSession();
  }
}
