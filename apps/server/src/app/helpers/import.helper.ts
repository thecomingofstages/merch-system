/**
 * POST /admin/import (D19): shops, products and variants from a sheet, all or nothing.
 * A shop that already exists (same name, live) gets the new products; a product name the shop
 * already has is refused, so importing the same sheet twice can't double the catalog.
 */
import type { ImportRequest, ImportResponse } from "@merch/shared";
import type { Connection } from "mongoose";
import type { z } from "zod";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";
import { type ImageStore, releaseImages, storeOptional } from "./images.helper";

type Body = z.output<typeof ImportRequest>;

export async function importCatalog(m: Models, db: Connection, store: ImageStore, body: Body): Promise<ImportResponse> {
  // One entry per shop name, even if the request lists a shop twice.
  const shops = new Map<string, Body["shops"][number]["products"]>();
  for (const s of body.shops) shops.set(s.shop_name, [...(shops.get(s.shop_name) ?? []), ...s.products]);

  const repeated = [...shops].flatMap(([shop, products]) =>
    products.filter((p, i) => products.findIndex((q) => q.name === p.name) !== i).map((p) => `${shop} / ${p.name}`),
  );
  if (repeated.length) throw ApiError.validation(`Listed twice: ${[...new Set(repeated)].join(", ")}`);

  const existing = await m.Shop.find({ shop_name: { $in: [...shops.keys()] }, archived: false }).lean();
  const shopIdOf = new Map(existing.map((s) => [s.shop_name, s._id]));
  const taken = await m.Product.find(
    { shop_id: { $in: existing.map((s) => s._id) }, archived: false, name: { $in: [...shops.values()].flat().map((p) => p.name) } },
    { name: 1, shop_id: 1 },
  ).lean();
  const clashes = taken
    .map((p) => [existing.find((s) => s._id.equals(p.shop_id))!.shop_name, p.name] as const)
    .filter(([shop, name]) => shops.get(shop)?.some((p) => p.name === name))
    .map(([shop, name]) => `${shop} / ${name}`);
  if (clashes.length) throw ApiError.validation(`Already in the shop: ${clashes.join(", ")}`);

  // Links are copied into R2 before anything is saved (D17); if saving fails, the copies go again.
  const copied: string[] = [];
  const keep = async (url: string | null) => {
    const stored = await storeOptional(store, url);
    if (stored && stored !== url) copied.push(stored);
    return stored ?? null;
  };
  // One download at a time: a sheet may link many images, and the Worker shouldn't open them all at once.
  type Product = Body["shops"][number]["products"][number];
  const prepared: { shop_name: string; product: Product }[] = [];
  for (const [shop_name, products] of shops) {
    for (const p of products) {
      const image: string[] = [];
      for (const url of p.image) image.push((await keep(url))!);
      const variants: Product["variants"] = [];
      for (const v of p.variants) variants.push({ ...v, image: await keep(v.image) });
      prepared.push({ shop_name, product: { ...p, image, variants } });
    }
  }

  try {
    return await db.transaction(async (session) => {
      const created = await m.Shop.create(
        [...shops.keys()].filter((name) => !shopIdOf.has(name)).map((shop_name) => ({ shop_name })),
        { session, ordered: true },
      );
      for (const s of created) shopIdOf.set(s.shop_name, s._id);
      await m.Product.insertMany(
        prepared.map(({ shop_name, product }) => ({ ...product, shop_id: shopIdOf.get(shop_name) })),
        { session },
      );
      return {
        shops_created: created.length,
        products_created: prepared.length,
        variants_created: prepared.reduce((n, p) => n + p.product.variants.length, 0),
      };
    });
  } catch (err) {
    await releaseImages(m, store, copied);
    throw err;
  }
}
