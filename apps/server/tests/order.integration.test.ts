/**
 * S5 through POST /orders, against a real database. Runs only when MONGODB_URI_TEST is
 * set (never the production database).
 */
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("POST /orders (S5)", { timeout: 60_000 }, () => {
  const app = buildApp({ ...testConfig, MONGODB_URI: uri! });
  const tag = `s5-test-${Date.now()}`;
  let db: Connection;
  let m: Models;
  let productId: string;
  let shirt: string; // price 250, buy_limit 2, stock 10
  let last: string; // price 100, stock 1

  const recipient = { first_name: "A", last_name: "B", nickname: "C", phone: "0812345678", email: "Buyer@Example.com" };
  const shipping_address = { details: "1 Road", tambon: "T", amphoe: "A", province: "P", postal_code: "10200" };
  const order = (items: object[], slip = `${tag}-${Math.random()}`) => ({ items, recipient, shipping_address, slip_qr_data: slip });
  const stockOf = async (vid: string) =>
    (await m.Product.findById(productId).lean())!.variants.find((v) => v._id.equals(vid))!.online_stock;

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
    const [shop] = await m.Shop.create([{ shop_name: `${tag} shop` }]);
    const [product] = await m.Product.create([
      {
        shop_id: shop!._id,
        name: `${tag} shirt`,
        variants: [
          { name: "M", price: 250, buy_limit: 2, online_stock: 10 },
          { name: "last one", price: 100, online_stock: 1 },
        ],
      },
    ]);
    productId = String(product!._id);
    shirt = String(product!.variants[0]!._id);
    last = String(product!.variants[1]!._id);
  }, 60_000);

  afterAll(async () => {
    await m?.Purchase.deleteMany({ slip_qr_data: { $regex: `^${tag}` } });
    await m?.Product.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Shop.deleteMany({ shop_name: { $regex: `^${tag}` } });
    await db?.close();
  });

  it("saves the order with database prices, copied names, and PENDING_CHECK, and takes the stock", async () => {
    const res = await request(app)
      .post("/orders")
      .send({ ...order([{ product_id: productId, variant_id: shirt, count: 2, unit_price: 1 }]), total: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: "ORDERED",
      payment_status: "PENDING_CHECK",
      subtotal: 500,
      shipping_fee: testConfig.SHIPPING_FEE,
      total: 500 + testConfig.SHIPPING_FEE,
    });
    const saved = await m.Purchase.findById(res.body._id).lean();
    expect(saved).toMatchObject({ original_price: 500, verify_method: "QR", users: null });
    expect(saved!.products[0]).toMatchObject({ product_name: `${tag} shirt` });
    expect(saved!.products[0]!.variants[0]).toMatchObject({ variant_name: "M", count: 2, unit_price: 250 });
    expect(saved!.recipient!.email).toBe("buyer@example.com");
    expect(await stockOf(shirt)).toBe(8);
  });

  it("rejects a slip that already paid an order, and keeps the stock", async () => {
    const slip = `${tag}-dup`;
    const items = [{ product_id: productId, variant_id: shirt, count: 1 }];
    expect((await request(app).post("/orders").send(order(items, slip))).status).toBe(201);
    const before = await stockOf(shirt);

    const again = await request(app).post("/orders").send(order(items, slip));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("DUPLICATE_SLIP");
    expect(await stockOf(shirt)).toBe(before);
  });

  it("two orders for the last item: only one succeeds, the other gets OUT_OF_STOCK", async () => {
    const items = [{ product_id: productId, variant_id: last, count: 1 }];
    const results = await Promise.all([request(app).post("/orders").send(order(items)), request(app).post("/orders").send(order(items))]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe("OUT_OF_STOCK");
    expect(await stockOf(last)).toBe(0);
  });

  it("enforces buy_limit, also when a variant is split over two lines", async () => {
    const line = { product_id: productId, variant_id: shirt, count: 2 };
    const res = await request(app).post("/orders").send(order([line, { ...line, count: 1 }]));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BUY_LIMIT");
  });

  it("rejects an order without slip_qr_data (D5) or with a bad phone", async () => {
    const items = [{ product_id: productId, variant_id: shirt, count: 1 }];
    const { slip_qr_data: _, ...noSlip } = order(items);
    const res = await request(app).post("/orders").send(noSlip);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("slip_qr_data");

    const badPhone = await request(app).post("/orders").send({ ...order(items), recipient: { ...recipient, phone: "12345" } });
    expect(badPhone.status).toBe(400);
  });
});
