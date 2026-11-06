/**
 * S7, S8 and S9 through the routes, against a real database. Runs only when
 * MONGODB_URI_TEST is set (never the production database).
 */
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { createSessionToken } from "../src/app/helpers/session.helper";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("admin orders, POS management, POS sales (S7–S9)", { timeout: 60_000 }, () => {
  const app = buildApp({ ...testConfig, MONGODB_URI: uri! });
  const admin = { Authorization: `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}` };
  const tag = `s7-test-${Date.now()}`;
  let db: Connection;
  let m: Models;
  let userId: string;
  let shopId: string;
  let otherShopId: string;
  let productId: string;
  let otherProductId: string;
  let otherVariant: string;
  let variant: string; // price 100, online stock 20, buy_limit 5
  let posId: string;
  const slip = (s: string) => `${tag}-${s}`;

  const item = (count: number) => ({ product_id: productId, variant_id: variant, count });
  const placeOrder = async (s: string, count = 1) => {
    const res = await request(app)
      .post("/orders")
      .set("Origin", testConfig.CORS_ORIGINS[0]!)
      .set("Cookie", `merch_session=${createSessionToken(userId, testConfig.SESSION_SECRET)}`)
      .send({
        items: [item(count)],
        recipient: { first_name: "A", last_name: "B", nickname: "C", phone: "0812345678", email: "a@example.com" },
        shipping_address: { details: "1", tambon: "T", amphoe: "A", province: "P", postal_code: "10200" },
        slip_qr_data: slip(s),
      });
    expect(res.status).toBe(201);
    return res.body._id as string;
  };
  const online = async () => (await m.Product.findById(productId).lean())!.variants[0]!.online_stock;
  const atPos = async () => {
    const pos = await m.Pos.findById(posId).lean();
    return pos!.products.flatMap((p) => p.variants).reduce((sum, v) => sum + v.pos_stock, 0);
  };
  const sale = (body: object) => request(app).post(`/pos/${posId}/sales`).set(admin).send(body);
  const payment = (id: string, payment_status: string) =>
    request(app).patch(`/admin/orders/${id}/payment`).set(admin).send({ payment_status });
  const tracking = (id: string) => request(app).patch(`/admin/orders/${id}/tracking`).set(admin).send({ tracking_id: "TH123" });

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
    const [user] = await m.User.create([{ email: `${tag}@example.com` }]);
    userId = String(user!._id);
    const shops = await m.Shop.create([{ shop_name: `${tag} a` }, { shop_name: `${tag} b` }]);
    shopId = String(shops[0]!._id);
    otherShopId = String(shops[1]!._id);
    const products = await m.Product.create([
      { shop_id: shopId, name: `${tag} p`, variants: [{ name: "M", price: 100, buy_limit: 5, online_stock: 20 }] },
      { shop_id: otherShopId, name: `${tag} other`, variants: [{ name: "X", price: 50, online_stock: 5 }] },
    ]);
    productId = String(products[0]!._id);
    variant = String(products[0]!.variants[0]!._id);
    otherProductId = String(products[1]!._id);
    otherVariant = String(products[1]!.variants[0]!._id);
  }, 60_000);

  afterAll(async () => {
    await m?.Purchase.deleteMany({ $or: [{ users: userId }, { pos_id: posId }] });
    await m?.Pos.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Product.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Shop.deleteMany({ shop_name: { $regex: `^${tag}` } });
    await m?.User.deleteMany({ _id: userId });
    await db?.close();
  });

  describe("S7", () => {
    it("needs the admin token", async () => {
      expect((await request(app).get("/admin/orders")).status).toBe(401);
      expect((await request(app).get("/admin/pos")).status).toBe(401);
      expect((await request(app).post(`/pos/${"f".repeat(24)}/sales`).send({})).status).toBe(401);
    });

    it("tracking is refused before verification, then sets SHIPPING", async () => {
      const id = await placeOrder("ship");
      const early = await tracking(id);
      expect(early.status).toBe(409);
      expect(early.body.error.code).toBe("NOT_VERIFIED");

      const verified = await payment(id, "VERIFIED");
      expect(verified.body.payment_status).toBe("VERIFIED");
      expect(verified.body.verified_at).toBeTruthy();

      const shipped = await tracking(id);
      expect(shipped.body).toMatchObject({ status: "SHIPPING", tracking_id: "TH123" });
    });

    it("rejecting returns the stock exactly once, even when two admins reject at once", async () => {
      const id = await placeOrder("reject", 3);
      const before = await online();
      const results = await Promise.all([payment(id, "REJECTED"), payment(id, "REJECTED")]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(results.find((r) => r.status === 409)!.body.error.code).toBe("NOT_PENDING");
      expect(await online()).toBe(before + 3);
      expect((await tracking(id)).body.error.code).toBe("NOT_VERIFIED");
    });

    it("a rejected order leaves the new-order count and list, unless asked for", async () => {
      const count = async (q = "status=ORDERED") => (await request(app).get(`/admin/orders/count?${q}`).set(admin)).body.count;
      const id = await placeOrder("badge");
      const before = await count();
      await payment(id, "REJECTED");
      expect(await count()).toBe(before - 1);
      const listed = (q: string) => request(app).get(`/admin/orders?${q}`).set(admin);
      const ids = (res: request.Response) => res.body.orders.map((o: { _id: string }) => o._id);
      expect(ids(await listed("status=ORDERED"))).not.toContain(id);
      expect(ids(await listed("payment_status=REJECTED"))).toContain(id);
    });

    it("a decided order can't be decided again", async () => {
      const id = await placeOrder("decided");
      await payment(id, "VERIFIED");
      const before = await online();
      expect((await payment(id, "REJECTED")).body.error.code).toBe("NOT_PENDING");
      expect(await online()).toBe(before);
    });

    it("lists and counts by status and payment status", async () => {
      const list = await request(app).get("/admin/orders?payment_status=REJECTED").set(admin);
      expect(list.status).toBe(200);
      expect(list.body.page).toBe(1);
      expect(list.body.page_size).toBe(20);
      expect(list.body.orders.every((o: { payment_status: string }) => o.payment_status === "REJECTED")).toBe(true);
      const count = await request(app).get("/admin/orders/count?status=SHIPPING").set(admin);
      expect(count.body.count).toBeGreaterThanOrEqual(1);
      expect((await request(app).get("/admin/orders?status=NOPE").set(admin)).status).toBe(400);
    });

    it("answers 404 for an unknown order", async () => {
      expect((await request(app).get(`/admin/orders/${"f".repeat(24)}`).set(admin)).status).toBe(404);
      expect((await payment("f".repeat(24), "VERIFIED")).status).toBe(404);
    });
  });

  describe("S8", () => {
    it("creates a POS for existing shops only", async () => {
      const res = await request(app).post("/admin/pos").set(admin).send({ name: `${tag} pos`, shop_ids: [shopId] });
      expect(res.status).toBe(201);
      posId = res.body._id;
      expect((await request(app).post("/admin/pos").set(admin).send({ name: `${tag} x`, shop_ids: ["f".repeat(24)] })).status).toBe(400);
    });

    it("transfers keep the total, also in parallel, and are logged", async () => {
      const total = (await online()) + (await atPos());
      const move = (amount: number) =>
        request(app).post(`/admin/pos/${posId}/transfer`).set(admin).send({ product_id: productId, variant_id: variant, amount });
      const results = await Promise.all([move(2), move(3)]);

      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect(await atPos()).toBe(5);
      expect((await online()) + (await atPos())).toBe(total);
      expect((await m.Pos.findById(posId).lean())!.stock_log.filter((l) => l.direction === "TO_POS")).toHaveLength(2);
    });

    it("refuses more than the online stock, and another shop's item, changing nothing", async () => {
      const before = await online();
      const tooMany = await request(app)
        .post(`/admin/pos/${posId}/transfer`)
        .set(admin)
        .send({ product_id: productId, variant_id: variant, amount: before + 1 });
      expect(tooMany.body.error.code).toBe("OUT_OF_STOCK");
      const wrongShop = await request(app)
        .post(`/admin/pos/${posId}/transfer`)
        .set(admin)
        .send({ product_id: otherProductId, variant_id: otherVariant, amount: 1 });
      expect(wrongShop.status).toBe(400);
      expect(await online()).toBe(before);
      expect(await atPos()).toBe(5);
    });
  });

  describe("S9", () => {
    it("a QR sale takes pos_stock, charges no shipping, and is VERIFIED", async () => {
      const onlineBefore = await online();
      const res = await sale({ items: [item(1)], verify_method: "QR", slip_qr_data: slip("pos1"), total: 1 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ subtotal: 100, shipping_fee: 0, total: 100, payment_status: "VERIFIED", verify_method: "QR" });
      expect(await atPos()).toBe(4);
      expect(await online()).toBe(onlineBefore);
      const saved = await m.Purchase.findById(res.body._id).lean();
      expect(saved).toMatchObject({ users: null, recipient: null, shipping_address: null });
      expect(String(saved!.pos_id)).toBe(posId);
    });

    it("rejects a duplicate slip, online or at a POS, and keeps the stock", async () => {
      const res = await sale({ items: [item(1)], verify_method: "QR", slip_qr_data: slip("pos1") });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_SLIP");
      expect(await atPos()).toBe(4);
    });

    it("two manual sales in a row both save, with no slip_qr_data", async () => {
      const a = await sale({ items: [item(1)], verify_method: "MANUAL" });
      const b = await sale({ items: [item(1)], verify_method: "MANUAL" });
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(await m.Purchase.findById(a.body._id).lean()).not.toHaveProperty("slip_qr_data");
      expect(await atPos()).toBe(2);
    });

    it("enforces buy_limit, also when a variant is split over two lines", async () => {
      await m.Pos.updateOne(
        { _id: posId },
        { $set: { "products.0.variants.0.pos_stock": 10 } },
      );
      const res = await sale({ items: [item(3), item(3)], verify_method: "MANUAL" });
      expect(res.body.error.code).toBe("BUY_LIMIT");
      await m.Pos.updateOne({ _id: posId }, { $set: { "products.0.variants.0.pos_stock": 2 } });
    });

    it("rejects a variant outside the POS's shops", async () => {
      const res = await sale({ items: [{ product_id: otherProductId, variant_id: otherVariant, count: 1 }], verify_method: "MANUAL" });
      expect(res.status).toBe(400);
    });

    it("two sales for the last item: only one succeeds", async () => {
      await m.Pos.updateOne({ _id: posId }, { $set: { "products.0.variants.0.pos_stock": 1 } });
      const results = await Promise.all([
        sale({ items: [item(1)], verify_method: "MANUAL" }),
        sale({ items: [item(1)], verify_method: "MANUAL" }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.error.code).toBe("OUT_OF_STOCK");
      expect(await atPos()).toBe(0);
      await m.Pos.updateOne({ _id: posId }, { $set: { "products.0.variants.0.pos_stock": 2 } });
    });

    it("needs a slip for QR, and refuses one for MANUAL", async () => {
      expect((await sale({ items: [item(1)], verify_method: "QR" })).status).toBe(400);
      expect((await sale({ items: [item(1)], verify_method: "MANUAL", slip_qr_data: "x" })).status).toBe(400);
    });

    it("POS sales stay out of the order lists and can't get a tracking ID", async () => {
      const res = await sale({ items: [item(1)], verify_method: "MANUAL" });
      const list = await request(app).get("/admin/orders").set(admin);
      expect(list.body.orders.map((o: { _id: string }) => o._id)).not.toContain(res.body._id);
      expect((await tracking(res.body._id)).status).toBe(400);
      expect((await payment(res.body._id, "REJECTED")).status).toBe(400);
    });
  });

  describe("S8 end of sale", () => {
    it("returns what's left, keeps the total, logs it, and empties the table", async () => {
      const total = (await online()) + (await atPos());
      const res = await request(app).post(`/admin/pos/${posId}/end-sale`).set(admin);
      expect(res.status).toBe(200);
      expect(res.body.products).toEqual([]);
      expect((await online()) + (await atPos())).toBe(total);
      expect(await atPos()).toBe(0);
      expect((await m.Pos.findById(posId).lean())!.stock_log.some((l) => l.direction === "TO_MAIN")).toBe(true);

      const again = await request(app).post(`/admin/pos/${posId}/end-sale`).set(admin);
      expect(again.status).toBe(200);
      expect((await online()) + (await atPos())).toBe(total);
    });
  });
});
