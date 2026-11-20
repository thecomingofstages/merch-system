/**
 * D19 through POST /admin/import, against a real database and an in-memory R2 bucket.
 * Runs only when MONGODB_URI_TEST is set (never the production database).
 */
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";
import { FakeBucket } from "./helpers/fakeBucket";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("POST /admin/import (D19)", { timeout: 60_000 }, () => {
  const bucket = new FakeBucket();
  const app = buildApp({ ...testConfig, MONGODB_URI: uri!, IMAGES: bucket as unknown as R2Bucket });
  const admin = { Authorization: `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}` };
  const tag = `d19-test-${Date.now()}`;
  let db: Connection;
  let m: Models;

  const variant = (name: string, online_stock = 5) => ({ name, price: 190, online_stock });
  const post = (shops: object[]) => request(app).post("/admin/import").set(admin).send({ shops });

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
  }, 60_000);

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    await m?.Product.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Shop.deleteMany({ shop_name: { $regex: `^${tag}` } });
    await db?.close();
  });

  it("needs the admin token", async () => {
    expect((await request(app).post("/admin/import").send({ shops: [] })).status).toBe(401);
  });

  it("creates the shops, products and variants with their stock, copying image links into R2", async () => {
    vi.stubGlobal("fetch", async () => new Response(Buffer.from("png"), { headers: { "Content-Type": "image/png" } }));
    const res = await post([
      {
        shop_name: `${tag} A`,
        products: [
          { name: `${tag} cap`, image: ["https://shop.example/cap.png"], variants: [variant("Red", 8), { ...variant("Black"), visible_to_online: false }] },
          { name: `${tag} shirt`, variants: [variant("S")] },
        ],
      },
      { shop_name: `${tag} B`, products: [{ name: `${tag} bag`, variants: [variant("Single", 25)] }] },
    ]);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ shops_created: 2, products_created: 3, variants_created: 4 });

    const shopA = await m.Shop.findOne({ shop_name: `${tag} A` }).lean();
    const cap = await m.Product.findOne({ name: `${tag} cap` }).lean();
    expect(cap!.shop_id.equals(shopA!._id)).toBe(true);
    expect(cap!.variants.map((v) => [v.name, v.online_stock, v.visible_to_online])).toEqual([["Red", 8, true], ["Black", 5, false]]);
    expect(cap!.image[0]).toMatch(/^https:\/\/images\.example\.test\//);
    expect(bucket.files.size).toBe(1);
  });

  it("adds to a shop that already exists, without a second shop of that name", async () => {
    const res = await post([{ shop_name: `${tag} A`, products: [{ name: `${tag} sticker`, variants: [variant("Set")] }] }]);
    expect(res.body).toEqual({ shops_created: 0, products_created: 1, variants_created: 1 });
    expect(await m.Shop.countDocuments({ shop_name: `${tag} A` })).toBe(1);
  });

  it("refuses a product the shop already has, or one listed twice, and writes nothing", async () => {
    const before = await m.Product.countDocuments({ name: { $regex: `^${tag}` } });
    const again = await post([{ shop_name: `${tag} A`, products: [{ name: `${tag} new`, variants: [variant("X")] }, { name: `${tag} cap`, variants: [variant("X")] }] }]);
    expect(again.status).toBe(400);
    expect(again.body.error.message).toContain(`${tag} A / ${tag} cap`);

    const twice = await post([{ shop_name: `${tag} C`, products: [{ name: `${tag} x`, variants: [variant("1")] }, { name: `${tag} x`, variants: [variant("2")] }] }]);
    expect(twice.status).toBe(400);
    expect(await m.Product.countDocuments({ name: { $regex: `^${tag}` } })).toBe(before);
    expect(await m.Shop.countDocuments({ shop_name: `${tag} C` })).toBe(0);
  });
});
