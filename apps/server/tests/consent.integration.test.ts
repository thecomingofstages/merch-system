/**
 * D20 through POST /analytics/consent, against a real database. Runs only when
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

describe.skipIf(!uri)("POST /analytics/consent (D20)", { timeout: 60_000 }, () => {
  const app = buildApp({ ...testConfig, MONGODB_URI: uri! });
  const visitor = randomUUID();
  let db: Connection;
  let m: Models;

  const post = (body: object, origin = testConfig.CORS_ORIGINS[0]!) =>
    request(app).post("/analytics/consent").set("Origin", origin).send(body);

  beforeAll(async () => {
    db = await mongoose.createConnection(uri!, dbConf).asPromise();
    m = models(db);
    await syncAllIndexes(db);
  }, 60_000);

  afterAll(async () => {
    await m?.AnalyticsConsent.deleteMany({ visitor_id: visitor });
    await db?.close();
  });

  it("records a yes with its version and time, then a withdrawal, on one record", async () => {
    expect((await post({ visitor_id: visitor, accepted: true, version: "v1" })).status).toBe(200);
    const yes = await m.AnalyticsConsent.findOne({ visitor_id: visitor }).lean();
    expect(yes).toMatchObject({ accepted: true, version: "v1", withdrawn_at: null });
    expect(yes!.accepted_at).toBeInstanceOf(Date);

    expect((await post({ visitor_id: visitor, accepted: false, version: "v1" })).status).toBe(200);
    const no = await m.AnalyticsConsent.findOne({ visitor_id: visitor }).lean();
    expect(no).toMatchObject({ accepted: false, accepted_at: yes!.accepted_at });
    expect(no!.withdrawn_at).toBeInstanceOf(Date);
    expect(await m.AnalyticsConsent.countDocuments({ visitor_id: visitor })).toBe(1);
  });

  it("refuses other sites and bodies that aren't a consent", async () => {
    expect((await post({ visitor_id: visitor, accepted: true, version: "v1" }, "https://evil.example")).status).toBe(403);
    expect((await post({ visitor_id: "not-a-uuid", accepted: true, version: "v1" })).status).toBe(400);
    expect((await post({ visitor_id: visitor, version: "v1" })).status).toBe(400);
  });
});
