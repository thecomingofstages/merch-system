/**
 * S6 through the routes, against a real database. Runs only when MONGODB_URI_TEST is set
 * (never the production database). Google's check is replaced; tests/auth.google.test.ts
 * covers the real one.
 */
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { ApiError } from "../src/app/utils/ApiError";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";

vi.mock("../src/app/helpers/auth.helper", async (original) => ({
  ...(await original<typeof import("../src/app/helpers/auth.helper")>()),
  verifyGoogleToken: vi.fn(),
}));
const { verifyGoogleToken } = await import("../src/app/helpers/auth.helper");

const uri = process.env.MONGODB_URI_TEST;
const origin = testConfig.CORS_ORIGINS[0]!;

describe.skipIf(!uri)("Google sign-in and sessions (S6)", { timeout: 60_000 }, () => {
  const app = buildApp({ ...testConfig, MONGODB_URI: uri! });
  const tag = `s6-test-${Date.now()}`;
  const email = `${tag}@example.com`;
  let db: Connection;
  let m: Models;
  let productId: string;
  let variantId: string;

  const signIn = () => request(app).post("/auth/google").set("Origin", origin).send({ id_token: "t" });
  const cookieOf = (res: request.Response) => (res.headers["set-cookie"] as unknown as string[])[0]!.split(";")[0]!;
  const order = (slip: string, phone = "0812345678") => ({
    items: [{ product_id: productId, variant_id: variantId, count: 1 }],
    recipient: { first_name: "Ann", last_name: "Lee", nickname: "A", phone, line_id: "ann", email: "other@example.com" },
    shipping_address: { details: "1 Road", tambon: "T", amphoe: "A", province: "P", postal_code: "10200" },
    slip_qr_data: `${tag}-${slip}`,
  });

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
    vi.mocked(verifyGoogleToken).mockResolvedValue({ email, given_name: "Google", family_name: "Name" });
    const [shop] = await m.Shop.create([{ shop_name: `${tag} shop` }]);
    const [product] = await m.Product.create([
      { shop_id: shop!._id, name: `${tag} p`, variants: [{ name: "M", price: 100, online_stock: 10 }] },
    ]);
    productId = String(product!._id);
    variantId = String(product!.variants[0]!._id);
  }, 60_000);

  afterAll(async () => {
    await m?.Purchase.deleteMany({ slip_qr_data: { $regex: `^${tag}` } });
    await m?.User.deleteMany({ email });
    await m?.Product.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Shop.deleteMany({ shop_name: { $regex: `^${tag}` } });
    await db?.close();
  });

  it("a rejected Google token gets 401 and no cookie", async () => {
    vi.mocked(verifyGoogleToken).mockRejectedValueOnce(ApiError.unauthorized("Invalid Google sign-in"));
    const res = await signIn();
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("GET /me and POST /orders need a session", async () => {
    expect((await request(app).get("/me")).status).toBe(401);
    expect((await request(app).get("/me").set("Cookie", "merch_session=forged.value")).status).toBe(401);
    const res = await request(app).post("/orders").set("Origin", origin).send(order("nosession"));
    expect(res.status).toBe(401);
  });

  it("a first sign-in creates the user: empty form apart from the name and email", async () => {
    const res = await signIn();
    expect(res.status).toBe(200);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const me = await request(app).get("/me").set("Cookie", cookieOf(res));
    expect(me.body).toEqual({
      email,
      first_name: "Google",
      last_name: "Name",
      nickname: null,
      phone: null,
      line_id: null,
      address: null,
    });
  });

  it("an order links the user and saves the details; a second sign-in autofills them", async () => {
    const cookie = cookieOf(await signIn());
    const placed = await request(app).post("/orders").set("Origin", origin).set("Cookie", cookie).send(order("first"));
    expect(placed.status).toBe(201);

    const saved = await m.Purchase.findById(placed.body._id).lean();
    const user = await m.User.findOne({ email }).lean();
    expect(saved!.users!.equals(user!._id)).toBe(true);
    expect(saved!.recipient!.email).toBe(email); // not the one in the body

    const again = await signIn();
    expect(again.body).toMatchObject({
      email,
      first_name: "Ann",
      last_name: "Lee",
      nickname: "A",
      phone: "0812345678",
      line_id: "ann",
      address: { tambon: "T", postal_code: "10200" },
    });
    expect(await m.User.countDocuments({ email })).toBe(1);
  });

  it("a failed order changes nothing on the user", async () => {
    const cookie = cookieOf(await signIn());
    const res = await request(app)
      .post("/orders")
      .set("Origin", origin)
      .set("Cookie", cookie)
      .send(order("first", "0899999999")); // the slip was used above
    expect(res.body.error.code).toBe("DUPLICATE_SLIP");
    expect((await m.User.findOne({ email }).lean())!.phone).toBe("0812345678");
  });

  it("rejects a foreign origin, no origin, and a non-JSON body (CSRF)", async () => {
    const cookie = cookieOf(await signIn());
    const evil = await request(app).post("/orders").set("Origin", "http://evil.test").set("Cookie", cookie).send(order("evil"));
    expect(evil.status).toBe(403);
    expect((await request(app).post("/orders").set("Cookie", cookie).send(order("noorigin"))).status).toBe(403);
    const form = await request(app).post("/orders").set("Origin", origin).set("Cookie", cookie).type("form").send({ a: "1" });
    expect(form.status).toBe(415);
    expect(await m.Purchase.countDocuments({ slip_qr_data: { $in: [`${tag}-evil`, `${tag}-noorigin`] } })).toBe(0);
  });
});
