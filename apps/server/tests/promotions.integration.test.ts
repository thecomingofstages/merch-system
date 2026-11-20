/**
 * Promotion sets (D13) through the routes, against a real database: the admin API, the
 * catalog, quotes, online orders, POS sales and the cascades. Runs only when
 * MONGODB_URI_TEST is set (never the production database).
 */
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { createSessionToken } from "../src/app/helpers/session.helper";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";

vi.mock("../src/app/helpers/email.helper", () => ({ sendOrderConfirmation: vi.fn(), sendShippingUpdate: vi.fn() }));

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("promotion sets (D13)", { timeout: 60_000 }, () => {
  const app = buildApp({ ...testConfig, MONGODB_URI: uri! });
  const admin = { Authorization: `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}` };
  const tag = `d13-test-${Date.now()}`;
  let db: Connection;
  let m: Models;
  let userId: string;
  let shirt: { product: string; s: string; m: string }; // shop A; S: 250, stock 3, buy_limit 1; M: 290, stock 5
  let bag: { product: string; b: string; hidden: string }; // shop B; B: 119, stock 4; hidden: not sold alone, stock 2
  let shopA: string;
  let setId: string;

  const fullSet = () => ({
    name: `${tag} set`,
    description: "two shirts and a bag",
    image: null,
    price: 599,
    items: [
      { product_id: shirt.product, variant_ids: [shirt.s, shirt.m], count: 2 },
      { product_id: bag.product, variant_ids: [bag.b, bag.hidden], count: 1 },
    ],
  });
  const picks = (shirts: [string, number][], bagVariant = bag.b) => ({
    promotion_id: setId,
    picks: [shirts.map(([variant_id, count]) => ({ variant_id, count })), [{ variant_id: bagVariant, count: 1 }]],
  });
  const quote = (body: object) => request(app).post("/quote").send({ channel: "ONLINE", items: [], ...body });
  const order = (body: object, slip = `${tag}-${Math.random()}`) =>
    request(app)
      .post("/orders")
      .set("Origin", testConfig.CORS_ORIGINS[0]!)
      .set("Cookie", `merch_session=${createSessionToken(userId, testConfig.SESSION_SECRET)}`)
      .send({
        items: [],
        recipient: { first_name: "A", last_name: "B", nickname: "C", phone: "0812345678", email: "a@example.com" },
        shipping_address: { details: "1", tambon: "T", amphoe: "A", province: "P", postal_code: "10200" },
        slip_qr_data: slip,
        ...body,
      });
  const stock = async (product: string, variant: string) =>
    (await m.Product.findById(product).lean())!.variants.find((v) => v._id.equals(variant))!.online_stock;

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
    const [user] = await m.User.create([{ email: `${tag}@example.com` }]);
    userId = String(user!._id);
    const shops = await m.Shop.create([{ shop_name: `${tag} a` }, { shop_name: `${tag} b` }]);
    shopA = String(shops[0]!._id);
    const [p1, p2] = await m.Product.create([
      {
        shop_id: shops[0]!._id,
        name: `${tag} shirt`,
        variants: [
          { name: "S", price: 250, online_stock: 3, buy_limit: 1 },
          { name: "M", price: 290, online_stock: 5 },
        ],
      },
      {
        shop_id: shops[1]!._id,
        name: `${tag} bag`,
        variants: [
          { name: "B", price: 119, online_stock: 4 },
          { name: "gift", price: 0, online_stock: 2, visible_to_online: false },
        ],
      },
    ]);
    shirt = { product: String(p1!._id), s: String(p1!.variants[0]!._id), m: String(p1!.variants[1]!._id) };
    bag = { product: String(p2!._id), b: String(p2!.variants[0]!._id), hidden: String(p2!.variants[1]!._id) };
  }, 60_000);

  afterAll(async () => {
    await m?.Purchase.deleteMany({ users: userId });
    await m?.Purchase.deleteMany({ "promotions.promotion_name": { $regex: `^${tag}` } });
    await m?.Promotion.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Pos.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Product.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Shop.deleteMany({ shop_name: { $regex: `^${tag}` } });
    await m?.User.deleteMany({ _id: userId });
    await db?.close();
  });

  it("admins create, list and edit sets; items must be live products and variants", async () => {
    expect((await request(app).get("/admin/promotions")).status).toBe(401);
    const bad = { ...fullSet(), items: [{ product_id: shirt.product, variant_ids: [bag.b], count: 1 }] };
    expect((await request(app).post("/admin/promotions").set(admin).send(bad)).body.error.code).toBe("VALIDATION");

    const created = await request(app).post("/admin/promotions").set(admin).send(fullSet());
    expect(created.status).toBe(201);
    setId = created.body._id;
    expect(created.body).toMatchObject({ active: true, archived: false, price: 599 });

    const edited = await request(app).patch(`/admin/promotions/${setId}`).set(admin).send({ ...fullSet(), price: 549 });
    expect(edited.body.price).toBe(549);
    await request(app).patch(`/admin/promotions/${setId}`).set(admin).send(fullSet());
    const list = await request(app).get("/admin/promotions").set(admin);
    expect(list.body.map((p: { _id: string }) => p._id)).toContain(setId);
  });

  it("the catalog shows active sets with every allowed variant, also one not sold alone", async () => {
    const shown = (await request(app).get("/catalog")).body.promotions.find((p: { _id: string }) => p._id === setId);
    expect(shown).toMatchObject({ price: 599, sold_out: false });
    expect(shown.items[1].variants.map((v: { _id: string }) => v._id)).toEqual([bag.b, bag.hidden]);

    await request(app).patch(`/admin/promotions/${setId}`).set(admin).send({ ...fullSet(), active: false });
    expect((await request(app).get("/catalog")).body.promotions.some((p: { _id: string }) => p._id === setId)).toBe(false);
    expect((await quote({ promotions: [picks([[shirt.m, 2]])] })).body.error.code).toBe("VALIDATION");
    await request(app).patch(`/admin/promotions/${setId}`).set(admin).send(fullSet());
  });

  it("quotes a set at its price, mixing variants, ignoring buy_limit, with single lines and shipping", async () => {
    const res = await quote({
      items: [{ product_id: bag.product, variant_id: bag.b, count: 1 }],
      promotions: [picks([[shirt.s, 1], [shirt.m, 1]]), picks([[shirt.s, 2]], bag.hidden)],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subtotal: 119 + 599 * 2, shipping_fee: 60, total: 119 + 599 * 2 + 60 });
    expect(res.body.promotions[1].picks[0]).toEqual([expect.objectContaining({ variant_id: shirt.s, count: 2 })]);
  });

  it("refuses a set with an item not filled, or picks that don't add up to the item's count", async () => {
    expect((await quote({ promotions: [{ promotion_id: setId, picks: [[{ variant_id: shirt.m, count: 2 }]] }] })).status).toBe(400);
    expect((await quote({ promotions: [picks([[shirt.m, 3]])] })).status).toBe(400);
  });

  it("an order takes the set's stock together with single lines, keeps a copy, and rejecting returns it", async () => {
    const before = await stock(shirt.product, shirt.m);
    const res = await order({ items: [{ product_id: shirt.product, variant_id: shirt.m, count: 1 }], promotions: [picks([[shirt.m, 2]])] });
    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(290 + 599);
    expect(await stock(shirt.product, shirt.m)).toBe(before - 3);
    const saved = await m.Purchase.findById(res.body._id).lean();
    expect(saved!.promotions[0]).toMatchObject({ promotion_name: `${tag} set`, price: 599 });
    expect(saved!.promotions[0]!.variants.map((v) => [v.variant_name, v.count])).toEqual([["M", 2], ["B", 1]]);

    await request(app).patch(`/admin/orders/${res.body._id}/payment`).set(admin).send({ payment_status: "REJECTED" });
    expect(await stock(shirt.product, shirt.m)).toBe(before);
  });

  it("answers OUT_OF_STOCK when single lines and sets together pass the stock", async () => {
    // M has 5: one single plus two sets of 2 is 5, a third set makes 7.
    const items = [{ product_id: shirt.product, variant_id: shirt.m, count: 1 }];
    expect((await quote({ items, promotions: [picks([[shirt.m, 2]]), picks([[shirt.m, 2]])] })).status).toBe(200);
    const res = await quote({ items, promotions: [picks([[shirt.m, 2]]), picks([[shirt.m, 2]]), picks([[shirt.m, 2]])] });
    expect(res.body.error.code).toBe("OUT_OF_STOCK");
  });

  it("a POS sells a set only when every item's shop is one of its shops, from pos_stock", async () => {
    const pos = (await request(app).post("/admin/pos").set(admin).send({ name: `${tag} pos`, shop_ids: [shopA] })).body;
    await request(app).post(`/admin/pos/${pos._id}/transfer`).set(admin).send({ product_id: shirt.product, variant_id: shirt.m, amount: 2 });
    const sale = (body: object) => request(app).post(`/pos/${pos._id}/sales`).set(admin).send({ items: [], verify_method: "MANUAL", ...body });
    expect((await sale({ promotions: [picks([[shirt.m, 2]])] })).body.error.code).toBe("VALIDATION");

    const shirtOnly = await request(app).post("/admin/promotions").set(admin).send({ ...fullSet(), name: `${tag} shirts`, price: 400, items: [fullSet().items[0]] });
    const res = await sale({ promotions: [{ promotion_id: shirtOnly.body._id, picks: [[{ variant_id: shirt.m, count: 2 }]] }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subtotal: 400, shipping_fee: 0 });
    const held = (await m.Pos.findById(pos._id).lean())!.products[0]!.variants[0]!.pos_stock;
    expect(held).toBe(0);
  });

  it("deleting a variant drops it from sets, and a set left with an empty item is archived; deleting a product archives its sets", async () => {
    await m.Product.updateOne({ _id: bag.product, "variants._id": bag.hidden }, { $set: { "variants.$.online_stock": 0 } });
    expect((await request(app).delete(`/admin/products/${bag.product}/variants/${bag.hidden}`).set(admin)).status).toBe(204);
    let set = await m.Promotion.findById(setId).lean();
    expect(set!.archived).toBe(false);
    expect(set!.items[1]!.variant_ids.map(String)).toEqual([bag.b]);

    await m.Product.updateOne({ _id: bag.product, "variants._id": bag.b }, { $set: { "variants.$.online_stock": 0 } });
    await request(app).delete(`/admin/products/${bag.product}/variants/${bag.b}`).set(admin);
    set = await m.Promotion.findById(setId).lean();
    expect(set!.archived).toBe(true);

    const other = await request(app).post("/admin/promotions").set(admin).send({ ...fullSet(), name: `${tag} other`, items: [fullSet().items[0]] });
    await m.Product.updateOne({ _id: shirt.product }, { $set: { "variants.$[].online_stock": 0 } });
    await m.Pos.updateMany({ name: { $regex: `^${tag}` } }, { $set: { products: [] } });
    expect((await request(app).delete(`/admin/products/${shirt.product}`).set(admin)).status).toBe(204);
    expect((await m.Promotion.findById(other.body._id).lean())!.archived).toBe(true);
  });
});
