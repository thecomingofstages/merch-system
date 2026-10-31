/**
 * Shops, products and variants for the dashboard (S2).
 * Nothing is deleted: DELETE archives, and answers 409 IN_USE while the item still has
 * online stock or a POS holds stock of it (docs/BACKEND.md "Data model").
 */
import type { CatalogResponse, ProductPatch, ProductRequest, ShopRequest, VariantPatch, VariantRequest } from "@merch/shared";
import type { Types } from "mongoose";
import type { z } from "zod";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

type Id = Types.ObjectId;
/** Bodies as the controllers hand them over: parsed, with defaults filled in. */
type Parsed<S extends z.ZodTypeAny> = z.output<S>;

// Shops

export const listShops = (m: Models, includeArchived: boolean) =>
  m.Shop.find(includeArchived ? {} : { archived: false }).sort({ shop_name: 1 }).lean();

export const createShop = async (m: Models, body: ShopRequest) => (await m.Shop.create(body)).toObject();

export async function updateShop(m: Models, id: Id, body: ShopRequest) {
  const shop = await m.Shop.findOneAndUpdate({ _id: id, archived: false }, body, { new: true, runValidators: true }).lean();
  if (!shop) throw ApiError.notFound("Shop not found");
  return shop;
}

export async function archiveShop(m: Models, id: Id) {
  if (!(await m.Shop.exists({ _id: id, archived: false }))) throw ApiError.notFound("Shop not found");
  const products = await m.Product.find({ shop_id: id, archived: false }, { _id: 1, variants: 1 }).lean();
  for (const p of products) await assertNoStock(m, p._id, p.variants);
  await m.Product.updateMany({ shop_id: id }, { $set: { archived: true, "variants.$[].archived": true } });
  await m.Shop.updateOne({ _id: id }, { archived: true });
}

// Products

export function listProducts(m: Models, filter: { shop_id?: Id; includeArchived: boolean }) {
  return m.Product.find({
    ...(filter.shop_id && { shop_id: filter.shop_id }),
    ...(!filter.includeArchived && { archived: false }),
  })
    .sort({ name: 1 })
    .lean();
}

export async function getProduct(m: Models, id: Id) {
  const product = await m.Product.findById(id).lean();
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function createProduct(m: Models, body: Parsed<typeof ProductRequest>) {
  await assertLiveShop(m, body.shop_id);
  return (await m.Product.create(body)).toObject();
}

export async function updateProduct(m: Models, id: Id, body: Parsed<typeof ProductPatch>) {
  if (body.shop_id) await assertLiveShop(m, body.shop_id);
  const product = await m.Product.findOneAndUpdate({ _id: id, archived: false }, { $set: body }, { new: true, runValidators: true }).lean();
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function archiveProduct(m: Models, id: Id) {
  const product = await m.Product.findOne({ _id: id, archived: false }, { variants: 1 }).lean();
  if (!product) throw ApiError.notFound("Product not found");
  await assertNoStock(m, id, product.variants);
  await m.Product.updateOne({ _id: id }, { $set: { archived: true, "variants.$[].archived": true } });
}

// Variants

export async function addVariant(m: Models, productId: Id, body: Parsed<typeof VariantRequest>) {
  const product = await m.Product.findOneAndUpdate(
    { _id: productId, archived: false },
    { $push: { variants: body } },
    { new: true, runValidators: true },
  ).lean();
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function updateVariant(m: Models, productId: Id, variantId: Id, body: Parsed<typeof VariantPatch>) {
  const set = Object.fromEntries(Object.entries(body).map(([k, v]) => [`variants.$.${k}`, v]));
  const product = await m.Product.findOneAndUpdate(
    { _id: productId, archived: false, variants: { $elemMatch: { _id: variantId, archived: false } } },
    { $set: set },
    { new: true, runValidators: true },
  ).lean();
  if (!product) throw ApiError.notFound("Variant not found");
  return product;
}

export async function archiveVariant(m: Models, productId: Id, variantId: Id) {
  const product = await m.Product.findOne(
    { _id: productId, archived: false, variants: { $elemMatch: { _id: variantId, archived: false } } },
    { variants: 1 },
  ).lean();
  if (!product) throw ApiError.notFound("Variant not found");
  await assertNoStock(m, productId, product.variants.filter((v) => v._id.equals(variantId)));
  await m.Product.updateOne({ _id: productId, "variants._id": variantId }, { $set: { "variants.$.archived": true } });
}

/**
 * Changes stock with one atomic $inc, so two admins at once both count. A negative
 * amount only applies while online_stock covers it.
 */
export async function addStock(m: Models, productId: Id, variantId: Id, amount: number) {
  const variant = { _id: variantId, archived: false, ...(amount < 0 && { online_stock: { $gte: -amount } }) };
  const product = await m.Product.findOneAndUpdate(
    { _id: productId, archived: false, variants: { $elemMatch: variant } },
    { $inc: { "variants.$.online_stock": amount } },
    { new: true },
  ).lean();
  if (product) return product;
  if (amount < 0 && (await m.Product.exists({ _id: productId, archived: false, variants: { $elemMatch: { _id: variantId, archived: false } } }))) {
    throw ApiError.conflict("OUT_OF_STOCK", "Can't remove more than the online stock");
  }
  throw ApiError.notFound("Variant not found");
}

// Checks

async function assertLiveShop(m: Models, shopId: string | Id) {
  if (!(await m.Shop.exists({ _id: shopId, archived: false }))) throw ApiError.validation("shop_id: no such shop");
}

/** 409 IN_USE while any of these variants has online stock, or a POS holds stock of them. */
async function assertNoStock(m: Models, productId: Id, variants: { _id: Id; online_stock: number }[]) {
  const stocked = variants.find((v) => v.online_stock > 0);
  if (stocked) throw ApiError.conflict("IN_USE", "Still has online stock: move it to 0 first");
  const ids = variants.map((v) => v._id);
  const atPos = await m.Pos.exists({
    products: {
      $elemMatch: { product_id: productId, variants: { $elemMatch: { variants_id: { $in: ids }, pos_stock: { $gt: 0 } } } },
    },
  });
  if (atPos) throw ApiError.conflict("IN_USE", "A POS still holds stock of it: end that sale first");
}

// Public catalog (S3)

/**
 * GET /catalog: live shops, their live products, and only the variants that are
 * visible_to_online and not archived, each with a sold_out flag. Products with no
 * such variant are left out.
 */
export async function getCatalog(m: Models): Promise<CatalogResponse> {
  const [shops, products] = await Promise.all([
    m.Shop.find({ archived: false }).sort({ shop_name: 1 }).lean(),
    m.Product.find({ archived: false }).sort({ name: 1 }).lean(),
  ]);
  return {
    shops: shops.map((shop) => ({
      _id: String(shop._id),
      shop_name: shop.shop_name,
      products: products
        .filter((p) => p.shop_id.equals(shop._id))
        .map((p) => ({
          _id: String(p._id),
          name: p.name,
          description: p.description,
          image: p.image,
          variants: p.variants
            .filter((v) => v.visible_to_online && !v.archived)
            .map((v) => ({
              _id: String(v._id),
              name: v.name,
              price: v.price,
              image: v.image ?? null,
              online_stock: v.online_stock,
              buy_limit: v.buy_limit,
              sold_out: v.online_stock <= 0,
            })),
        }))
        .filter((p) => p.variants.length > 0),
    })),
  };
}
