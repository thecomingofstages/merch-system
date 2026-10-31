/**
 * S2–S4 through the real routes, against a real database. Runs only when
 * MONGODB_URI_TEST is set (never the production database). Each request opens its own
 * connection, as on Workers, so this is slow.
 */
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("catalog, admin API and quote (S2–S4)", { timeout: 60_000 }, () => {
  const app = buildApp({ ...testConfig, MONGODB_URI: uri! });
  const admin = { Authorization: `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}` };
  const tag = `s2-test-${Date.now()}`;
  let db: Connection;
  let m: Models;
  let shopId: string;
  let productId: string;
  let small: string; // variant with buy_limit 2
  let large: string; // variant, no limit
  let hidden: string; // visible_to_online: false

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
  }, 60_000);

  afterAll(async () => {
    const shops = await m?.Shop.find({ shop_name: { $regex: `^${tag}` } }, { _id: 1 }).lean();
    const ids = (shops ?? []).map((s) => s._id);
    await m?.Product.deleteMany({ shop_id: { $in: ids } });
    await m?.Pos.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Shop.deleteMany({ _id: { $in: ids } });
    await db?.close();
  });

  it("admin routes need the token", async () => {
    expect((await request(app).get("/admin/shops")).status).toBe(401);
    expect((await request(app).post("/admin/products").send({})).status).toBe(401);
  });

  it("creates a shop, then a product with variants", async () => {
    const shop = await request(app).post("/admin/shops").set(admin).send({ shop_name: `${tag} shop` });
    expect(shop.status).toBe(201);
    shopId = shop.body._id;

    const product = await request(app)
      .post("/admin/products")
      .set(admin)
      .send({
        shop_id: shopId,
        name: `${tag} product`,
        variants: [
          { name: "S", price: 250, buy_limit: 2 },
          { name: "L", price: 300 },
          { name: "hidden", price: 1, visible_to_online: false },
        ],
      });
    expect(product.status).toBe(201);
    productId = product.body._id;
    [small, large, hidden] = product.body.variants.map((v: { _id: string }) => v._id);
    expect(product.body.variants.every((v: { online_stock: number }) => v.online_stock === 0)).toBe(true);
  });

  it("rejects bad bodies and unknown shops", async () => {
    const bad = await request(app).post("/admin/products").set(admin).send({ shop_id: shopId, name: "x", variants: [{ name: "x", price: 9.5 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION");
    const noShop = await request(app).post("/admin/products").set(admin).send({ shop_id: "f".repeat(24), name: "x" });
    expect(noShop.status).toBe(400);
  });

  it("edits a product, adds and edits a variant", async () => {
    expect((await request(app).patch(`/admin/products/${productId}`).set(admin).send({ description: "d" })).body.description).toBe("d");
    const added = await request(app).post(`/admin/products/${productId}/variants`).set(admin).send({ name: "XL", price: 320 });
    expect(added.status).toBe(201);
    expect(added.body.variants).toHaveLength(4);
    const edited = await request(app).patch(`/admin/products/${productId}/variants/${large}`).set(admin).send({ price: 310 });
    expect(edited.body.variants.find((v: { _id: string }) => v._id === large).price).toBe(310);
  });

  it("adds stock atomically, and can't take it below 0", async () => {
    const add = (vid: string, amount: number) =>
      request(app).post(`/admin/products/${productId}/variants/${vid}/stock`).set(admin).send({ amount });
    await Promise.all([add(small, 5), add(small, 5), add(large, 1)]);
    const p = await m.Product.findById(productId).lean();
    expect(p!.variants.find((v) => v._id.equals(small))!.online_stock).toBe(10);

    const tooMany = await add(large, -2);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe("OUT_OF_STOCK");
    expect((await add(small, 0)).status).toBe(400);
  });

  it("GET /catalog shows only visible variants, with sold_out", async () => {
    await request(app).patch(`/admin/products/${productId}/variants/${large}`).set(admin).send({ name: "L" });
    await request(app).post(`/admin/products/${productId}/variants/${large}/stock`).set(admin).send({ amount: -1 });

    const res = await request(app).get("/catalog");
    expect(res.status).toBe(200);
    const shop = res.body.shops.find((s: { _id: string }) => s._id === shopId);
    const variants = shop.products[0].variants;
    expect(variants.map((v: { _id: string }) => v._id)).not.toContain(hidden);
    expect(variants.find((v: { _id: string }) => v._id === small)).toMatchObject({ sold_out: false, online_stock: 10 });
    expect(variants.find((v: { _id: string }) => v._id === large)).toMatchObject({ sold_out: true });
  });

  it("POST /quote prices from the database and ignores client prices", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ channel: "ONLINE", items: [{ product_id: productId, variant_id: small, count: 2, unit_price: 1 }], total: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subtotal: 500, shipping_fee: testConfig.SHIPPING_FEE, total: 500 + testConfig.SHIPPING_FEE });
    expect(res.body.promptpay_id).toBe(testConfig.PROMPTPAY_ID);
    expect(res.body.lines[0]).toMatchObject({ unit_price: 250, variant_name: "S" });
  });

  it("POST /quote enforces buy_limit, also when a variant is split over two lines", async () => {
    const line = { product_id: productId, variant_id: small, count: 2 };
    const res = await request(app).post("/quote").send({ channel: "ONLINE", items: [line, { ...line, count: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BUY_LIMIT");
  });

  it("POST /quote rejects sold-out and hidden variants online", async () => {
    const out = await request(app).post("/quote").send({ channel: "ONLINE", items: [{ product_id: productId, variant_id: large, count: 1 }] });
    expect(out.body.error.code).toBe("OUT_OF_STOCK");
    const hid = await request(app).post("/quote").send({ channel: "ONLINE", items: [{ product_id: productId, variant_id: hidden, count: 1 }] });
    expect(hid.status).toBe(400);
  });

  it("POST /quote for a POS uses pos_stock, its shops only, and no shipping", async () => {
    const [pos] = await m.Pos.create([
      {
        name: `${tag} pos`,
        shop_ids: [shopId],
        products: [{ product_id: productId, variants: [{ variants_id: hidden, pos_stock: 3 }] }],
      },
    ]);
    const res = await request(app)
      .post("/quote")
      .send({ channel: "POS", pos_id: String(pos!._id), items: [{ product_id: productId, variant_id: hidden, count: 3 }] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subtotal: 3, shipping_fee: 0, total: 3 });

    const notThere = await request(app)
      .post("/quote")
      .send({ channel: "POS", pos_id: String(pos!._id), items: [{ product_id: productId, variant_id: small, count: 1 }] });
    expect(notThere.body.error.code).toBe("OUT_OF_STOCK");
  });

  it("archiving refuses while stock exists, then hides the item", async () => {
    const blocked = await request(app).delete(`/admin/products/${productId}/variants/${small}`).set(admin);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("IN_USE");
    expect((await request(app).delete(`/admin/products/${productId}/variants/${hidden}`).set(admin)).status).toBe(409); // at the POS

    await request(app).post(`/admin/products/${productId}/variants/${small}/stock`).set(admin).send({ amount: -10 });
    expect((await request(app).delete(`/admin/products/${productId}/variants/${small}`).set(admin)).status).toBe(204);

    const shop = (await request(app).get("/catalog")).body.shops.find((s: { _id: string }) => s._id === shopId);
    expect(shop.products[0].variants.map((v: { _id: string }) => v._id)).not.toContain(small);
    expect((await m.Product.findById(productId).lean())!.variants).toHaveLength(4); // still there, archived
  });

  it("archiving a shop refuses while a POS holds its stock", async () => {
    const res = await request(app).delete(`/admin/shops/${shopId}`).set(admin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("IN_USE");
  });

  it("answers 404 for malformed and unknown ids", async () => {
    expect((await request(app).get("/admin/products/nope").set(admin)).status).toBe(404);
    expect((await request(app).get(`/admin/products/${"f".repeat(24)}`).set(admin)).status).toBe(404);
  });
});
