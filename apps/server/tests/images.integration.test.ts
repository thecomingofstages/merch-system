/**
 * D17 through the routes, against a real database and an in-memory R2 bucket: links are
 * copied in on save, and a file goes once no live product, variant or set uses it.
 * Runs only when MONGODB_URI_TEST is set (never the production database).
 */
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";
import { FakeBucket } from "./helpers/fakeBucket";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("images in R2 (D17)", { timeout: 60_000 }, () => {
  const bucket = new FakeBucket();
  const app = buildApp({ ...testConfig, MONGODB_URI: uri!, IMAGES: bucket as unknown as R2Bucket });
  const admin = { Authorization: `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}` };
  const tag = `d17-test-${Date.now()}`;
  let db: Connection;
  let m: Models;
  let shopId: string;

  const upload = async () =>
    (await request(app).post("/admin/images").set(admin).set("Content-Type", "image/webp").send(Buffer.from("webp"))).body.url as string;
  const stored = (url: string) => bucket.files.has(url.split("/").pop()!);
  const product = (body: object) => request(app).post("/admin/products").set(admin).send({ shop_id: shopId, name: `${tag} p`, ...body });

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
    shopId = String((await m.Shop.create({ shop_name: `${tag} shop` }))._id);
  }, 60_000);

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await m?.Promotion.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Product.deleteMany({ name: { $regex: `^${tag}` } });
    await m?.Shop.deleteMany({ shop_name: { $regex: `^${tag}` } });
    await db?.close();
  });

  it("copies a linked image into R2 when a product is saved", async () => {
    vi.stubGlobal("fetch", async () => new Response(Buffer.from("png"), { headers: { "Content-Type": "image/png" } }));
    const res = await product({ image: ["https://shop.example/cap.png"], variants: [{ name: "M", price: 100, image: "https://shop.example/m.png" }] });
    expect(res.status).toBe(201);
    expect(res.body.image[0]).toMatch(/^https:\/\/images\.example\.test\//);
    expect(res.body.variants[0].image).toMatch(/^https:\/\/images\.example\.test\//);
    expect(stored(res.body.image[0]) && stored(res.body.variants[0].image)).toBe(true);
  });

  it("replacing an image deletes the old file, unless another live product still uses it", async () => {
    const [a, shared, b] = [await upload(), await upload(), await upload()];
    const p = (await product({ image: [a, shared] })).body;
    await product({ name: `${tag} other`, image: [shared] });

    const res = await request(app).patch(`/admin/products/${p._id}`).set(admin).send({ image: [b] });
    expect(res.body.image).toEqual([b]);
    expect(stored(a)).toBe(false);
    expect(stored(shared)).toBe(true);
    expect(stored(b)).toBe(true);
  });

  it("a failed R2 delete doesn't fail the archive, which is already saved", async () => {
    const img = await upload();
    const p = (await product({ image: [img] })).body;
    const del = vi.spyOn(bucket, "delete").mockRejectedValueOnce(new Error("R2 down"));
    expect((await request(app).delete(`/admin/products/${p._id}`).set(admin)).status).toBe(204);
    expect(del).toHaveBeenCalled();
    del.mockRestore();
  });

  it("archiving a product deletes its images and its variants' images", async () => {
    const [img, vimg] = [await upload(), await upload()];
    const p = (await product({ image: [img], variants: [{ name: "S", price: 100, image: vimg }] })).body;
    expect((await request(app).delete(`/admin/products/${p._id}`).set(admin)).status).toBe(204);
    expect(stored(img) || stored(vimg)).toBe(false);
  });

  it("replacing or archiving a variant deletes its old image", async () => {
    const [v1, v2] = [await upload(), await upload()];
    const p = (await product({ variants: [{ name: "S", price: 100, image: v1 }] })).body;
    const vid = p.variants[0]._id;
    await request(app).patch(`/admin/products/${p._id}/variants/${vid}`).set(admin).send({ image: v2 });
    expect(stored(v1)).toBe(false);
    await request(app).delete(`/admin/products/${p._id}/variants/${vid}`).set(admin);
    expect(stored(v2)).toBe(false);
  });

  it("a set's image goes when the set is archived, also by the cascade from its product", async () => {
    const p = (await product({ variants: [{ name: "S", price: 100 }] })).body;
    const set = (img: string, name: string) =>
      request(app).post("/admin/promotions").set(admin).send({
        name: `${tag} ${name}`,
        price: 100,
        image: img,
        items: [{ product_id: p._id, variant_ids: [p.variants[0]._id], count: 1 }],
      });
    const [s1, s2] = [await upload(), await upload()];
    const first = (await set(s1, "set")).body;
    await set(s2, "set 2");

    await request(app).delete(`/admin/promotions/${first._id}`).set(admin);
    expect(stored(s1)).toBe(false);
    await request(app).delete(`/admin/products/${p._id}`).set(admin);
    expect(stored(s2)).toBe(false);
  });
});
