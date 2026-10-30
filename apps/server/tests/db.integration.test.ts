/**
 * S1 against a real database. Runs only when MONGODB_URI_TEST is set (never the
 * production database): `MONGODB_URI_TEST=... npx vitest run tests/db.integration.test.ts`.
 * Builds the indexes, then checks they hold and that a transaction runs.
 */
import mongoose, { type Connection } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbConf } from "../src/app/config/db.conf";
import { models, syncAllIndexes, type Models } from "../src/app/models";

const uri = process.env.MONGODB_URI_TEST;

describe.skipIf(!uri)("database (S1)", () => {
  let db: Connection;
  let m: Models;
  const tag = `s1-test-${Date.now()}`;

  type SaleExtra = { verify_method?: "QR" | "MANUAL"; slip_qr_data?: string; tracking_provider?: string };
  const sale = (extra: SaleExtra = {}) => ({
    products: [],
    original_price: 0,
    shipping_fee: 0,
    verify_method: "MANUAL" as "QR" | "MANUAL",
    tracking_id: tag,
    ...extra,
  });

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
  }, 60_000);

  afterAll(async () => {
    await m?.Purchase.deleteMany({ tracking_id: tag });
    await m?.User.deleteMany({ email: { $regex: `^${tag}` } });
    await db?.close();
  });

  it("two sales without a slip both save", async () => {
    await m.Purchase.create([sale(), sale()]);
    expect(await m.Purchase.countDocuments({ tracking_id: tag, slip_qr_data: { $exists: false } })).toBeGreaterThanOrEqual(2);
  });

  it("the same slip can't pay twice", async () => {
    const slip = `${tag}-slip`;
    await m.Purchase.create(sale({ verify_method: "QR", slip_qr_data: slip }));
    await expect(m.Purchase.create(sale({ verify_method: "QR", slip_qr_data: slip }))).rejects.toMatchObject({ code: 11000 });
  });

  it("users.email is unique", async () => {
    await m.User.create({ email: `${tag}@example.com` });
    await expect(m.User.create({ email: `${tag}@example.com` })).rejects.toMatchObject({ code: 11000 });
  });

  it("a transaction commits, and an aborted one leaves nothing", async () => {
    const session = await db.startSession();
    try {
      await session.withTransaction(async () => {
        await m.Purchase.create([sale({ tracking_provider: "commit" })], { session });
      });
      await expect(
        session.withTransaction(async () => {
          await m.Purchase.create([sale({ tracking_provider: "abort" })], { session });
          throw new Error("abort");
        }),
      ).rejects.toThrow("abort");
    } finally {
      await session.endSession();
    }
    expect(await m.Purchase.countDocuments({ tracking_id: tag, tracking_provider: "commit" })).toBe(1);
    expect(await m.Purchase.countDocuments({ tracking_id: tag, tracking_provider: "abort" })).toBe(0);
  });
});
