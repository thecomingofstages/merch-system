import { z } from "zod";
import { IsoDateTime, NonNegativeInt, ObjectId, PositiveInt } from "./common";

export const StockLogDirection = z.enum(["TO_POS", "TO_MAIN"]);
export type StockLogDirection = z.infer<typeof StockLogDirection>;

export const PosVariantStock = z.object({
  variants_id: ObjectId,
  pos_stock: NonNegativeInt,
});
export type PosVariantStock = z.infer<typeof PosVariantStock>;

export const PosProductStock = z.object({
  product_id: ObjectId,
  variants: z.array(PosVariantStock),
});
export type PosProductStock = z.infer<typeof PosProductStock>;

export const StockLogEntry = z.object({
  product_id: ObjectId,
  variant_id: ObjectId,
  amount: PositiveInt,
  direction: StockLogDirection,
  at: IsoDateTime,
});
export type StockLogEntry = z.infer<typeof StockLogEntry>;

export const Pos = z.object({
  _id: ObjectId,
  name: z.string().trim().min(1),
  shop_ids: z.array(ObjectId),
  products: z.array(PosProductStock),
  stock_log: z.array(StockLogEntry),
});
export type Pos = z.infer<typeof Pos>;

// POST /admin/pos
export const CreatePosRequest = z.object({
  name: z.string().trim().min(1),
  shop_ids: z.array(ObjectId).min(1),
});
export type CreatePosRequest = z.infer<typeof CreatePosRequest>;

// POST /admin/pos/:id/transfer { product_id, variant_id, amount }
export const TransferRequest = z.object({
  product_id: ObjectId,
  variant_id: ObjectId,
  amount: PositiveInt,
});
export type TransferRequest = z.infer<typeof TransferRequest>;
