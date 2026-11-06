import { z } from "zod";
import { baht, count, IsoDateTime, objectId } from "./common";
import { VerifyMethod } from "./purchase";
import { CartItem } from "./quote";

export const StockLogDirection = z.enum(["TO_POS", "TO_MAIN"]);
export type StockLogDirection = z.infer<typeof StockLogDirection>;

export const PosVariantStock = z.object({
  variants_id: objectId,
  pos_stock: baht,
});
export type PosVariantStock = z.infer<typeof PosVariantStock>;

export const PosProductStock = z.object({
  product_id: objectId,
  variants: z.array(PosVariantStock),
});
export type PosProductStock = z.infer<typeof PosProductStock>;

export const StockLogEntry = z.object({
  product_id: objectId,
  variant_id: objectId,
  amount: count,
  direction: StockLogDirection,
  at: IsoDateTime,
});
export type StockLogEntry = z.infer<typeof StockLogEntry>;

export const Pos = z.object({
  _id: objectId,
  name: z.string().trim().min(1),
  shop_ids: z.array(objectId),
  products: z.array(PosProductStock),
  stock_log: z.array(StockLogEntry),
});
export type Pos = z.infer<typeof Pos>;

/** GET /admin/pos leaves out stock_log, which only grows; GET /admin/pos/:id has it. */
export const PosSummary = Pos.omit({ stock_log: true });
export type PosSummary = z.infer<typeof PosSummary>;

/** POST /admin/pos */
export const CreatePosRequest = z.object({
  name: z.string().trim().min(1),
  shop_ids: z.array(objectId).min(1),
});
export type CreatePosRequest = z.infer<typeof CreatePosRequest>;

/** POST /admin/pos/:id/transfer { product_id, variant_id, amount } */
export const TransferRequest = z.object({
  product_id: objectId,
  variant_id: objectId,
  amount: count,
});
export type TransferRequest = z.infer<typeof TransferRequest>;

/** POST /pos/:id/sales: QR requires slip_qr_data; MANUAL must omit slip_qr_data. */
export const CreatePosSaleRequest = z
  .object({
    items: z.array(CartItem).min(1),
    verify_method: VerifyMethod,
    slip_qr_data: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) =>
      (data.verify_method === "QR" && typeof data.slip_qr_data === "string" && data.slip_qr_data.length > 0) ||
      (data.verify_method === "MANUAL" && data.slip_qr_data === undefined),
    {
      message: "slip_qr_data is required for QR verification and must be omitted for MANUAL verification",
      path: ["slip_qr_data"],
    },
  );
export type CreatePosSaleRequest = z.infer<typeof CreatePosSaleRequest>;

export const CreatePosSaleResponse = z.object({
  _id: objectId,
  verify_method: VerifyMethod,
  payment_status: z.literal("VERIFIED"),
  subtotal: baht,
  shipping_fee: baht,
  total: baht,
  created_at: IsoDateTime,
});
export type CreatePosSaleResponse = z.infer<typeof CreatePosSaleResponse>;
