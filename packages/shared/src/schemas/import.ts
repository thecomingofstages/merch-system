/**
 * POST /admin/import (D19): shops with their products and variants, as read from a sheet.
 * Variants carry their starting online stock; everything else is as in ProductRequest.
 */
import { z } from "zod";
import { baht } from "./common";
import { ProductRequest, VariantRequest } from "./product";

export const ImportVariant = VariantRequest.extend({ online_stock: baht.default(0) });
export const ImportProduct = ProductRequest.omit({ shop_id: true, variants: true }).extend({
  variants: z.array(ImportVariant).min(1),
});
export const ImportShop = z.object({ shop_name: z.string().trim().min(1), products: z.array(ImportProduct).min(1) });

export const ImportRequest = z.object({ shops: z.array(ImportShop).min(1) });
export type ImportRequest = z.input<typeof ImportRequest>;

export const ImportResponse = z.object({ shops_created: baht, products_created: baht, variants_created: baht });
export type ImportResponse = z.infer<typeof ImportResponse>;
