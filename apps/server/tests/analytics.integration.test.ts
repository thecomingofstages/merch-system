/**
 * D21 through /analytics/events and /admin/analytics, against a real database. Runs only when
 * MONGODB_URI_TEST is set (never the production database).
 */
import { randomUUID } from "node:crypto";
import mongoose, { type Connection } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { models, syncAllIndexes, type Models } from "../src/app/models";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("usage statistics (D21)", { timeout: 60_000 }, () => {
  const app = buildApp({ ...testConfig, MONGODB_URI: uri! });
  const admin = { Authorization: `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}` };
  const [ann, bob, stranger] = [randomUUID(), randomUUID(), randomUUID()];
  const [s1, s2, s3] = [randomUUID(), randomUUID(), randomUUID()];
  let db: Connection;
  let m: Models;
  let cap: string;
  let shirt: string;

  const send = (visitor_id: string, session_id: string, events: object[]) =>
    request(app).post("/analytics/events").set("Origin", testConfig.CORS_ORIGINS[0]!).send({ visitor_id, session_id, events });

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
    await m.AnalyticsEvent.deleteMany({});
    const shop = await m.Shop.create({ shop_name: `d21-test-${Date.now()}` });
    const variants = [{ name: "One", price: 100, online_stock: 5 }];
    cap = String((await m.Product.create({ shop_id: shop._id, name: "D21 cap", variants }))._id);
    shirt = String((await m.Product.create({ shop_id: shop._id, name: "D21 shirt", variants }))._id);
    await m.AnalyticsConsent.create([
      { visitor_id: ann, accepted: true, version: "v1", accepted_at: new Date() },
      { visitor_id: bob, accepted: true, version: "v1", accepted_at: new Date() },
    ]);
  }, 60_000);

  afterAll(async () => {
    await m?.AnalyticsEvent.deleteMany({});
    await m?.AnalyticsConsent.deleteMany({ visitor_id: { $in: [ann, bob] } });
    await m?.Product.deleteMany({ name: { $in: ["D21 cap", "D21 shirt"] } });
    await db?.close();
  });

  it("refuses events from a visitor without a recorded yes, and keeps none", async () => {
    const res = await send(stranger, s1, [{ type: "view", product_id: randomHex() }]);
    expect([res.status, res.body.error.code]).toEqual([409, "NO_CONSENT"]);
    expect(await m.AnalyticsEvent.countDocuments({ visitor_id: stranger })).toBe(0);
  });

  it("counts each step as hits, sessions and visitors, and labels visits with an order", async () => {
    // Ann: two visits; the second reloads the cap twice and orders it. Bob: one visit, only looks.
    expect((await send(ann, s1, [{ type: "impression", product_id: cap }, { type: "view", product_id: cap }])).status).toBe(200);
    await send(ann, s2, [
      { type: "view", product_id: cap },
      { type: "view", product_id: cap },
      { type: "add_to_cart", product_id: cap },
      { type: "checkout", product_id: cap },
      { type: "purchase", product_id: cap },
    ]);
    await send(bob, s3, [
      { type: "impression", product_id: cap },
      { type: "impression", product_id: shirt },
      { type: "view", product_id: cap },
      { type: "view", product_id: randomHex() }, // no such product: not a row on the dashboard
    ]);

    const res = await request(app).get("/admin/analytics").set(admin);
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ visitors: 2, sessions: 3, purchased_sessions: 1 });
    const row = res.body.products.find((p: { product_id: string }) => p.product_id === cap);
    expect(row.product_name).toBe("D21 cap");
    expect(row.view).toEqual({ hits: 4, sessions: 3, visitors: 2 });
    expect(row.purchase).toEqual({ hits: 1, sessions: 1, visitors: 1 });
    expect(res.body.products.find((p: { product_id: string }) => p.product_id === shirt).view).toEqual({ hits: 0, sessions: 0, visitors: 0 });
    expect(res.body.products.map((p: { product_id: string }) => p.product_id).sort()).toEqual([cap, shirt].sort());
  });

  it("buckets days in Thailand time and filters by them", async () => {
    // 18:30 UTC on the 20th is 01:30 on the 21st in Bangkok.
    await m.AnalyticsEvent.create({ visitor_id: ann, session_id: s1, type: "view", product_id: shirt, at: new Date("2026-11-20T18:30:00Z") });
    const daily = await request(app).get(`/admin/analytics/${shirt}/daily`).set(admin);
    expect(daily.body.days.find((d: { date: string }) => d.date === "2026-11-21").view.hits).toBe(1);
    const on20 = await request(app).get("/admin/analytics?from=2026-11-20&to=2026-11-20").set(admin);
    expect(on20.body.products).toEqual([]);
    const on21 = await request(app).get("/admin/analytics?from=2026-11-21&to=2026-11-21").set(admin);
    expect(on21.body.products.map((p: { product_id: string }) => p.product_id)).toContain(shirt);
  });

  it("deletes the events before a day, or all of them, and needs the admin token", async () => {
    expect((await request(app).delete("/admin/analytics")).status).toBe(401);
    const before = await request(app).delete("/admin/analytics?before=2026-11-21").set(admin);
    expect(before.body).toEqual({ deleted: 0 }); // 01:30 on the 21st, Bangkok, isn't before the 21st
    const all = await request(app).delete("/admin/analytics").set(admin);
    expect(all.body.deleted).toBeGreaterThan(0);
    expect(await m.AnalyticsEvent.countDocuments()).toBe(0);
  });
});

function randomHex() {
  return [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
