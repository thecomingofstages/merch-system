/** D17: uploads to R2 and copying links, against an in-memory bucket (no database). */
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { imageStore, storeLink } from "../src/app/helpers/images.helper";
import { buildApp } from "../src/app/server";
import { testConfig } from "./helpers/app";
import { FakeBucket } from "./helpers/fakeBucket";

const admin = { Authorization: `Bearer ${testConfig.ADMIN_ACCESS_TOKEN}` };
const png = Buffer.from("89504e470d0a1a0a", "hex");
const setup = () => {
  const bucket = new FakeBucket();
  const config = { ...testConfig, IMAGES: bucket as unknown as R2Bucket };
  return { bucket, app: buildApp(config), store: imageStore(config) };
};
const ours = /^https:\/\/images\.example\.test\/[0-9a-f-]{36}\.(webp|png|jpg)$/;

describe("POST /admin/images (D17)", () => {
  it("needs the admin token", async () => {
    expect((await request(setup().app).post("/admin/images").set("Content-Type", "image/png").send(png)).status).toBe(401);
  });

  it("stores the bytes under a new key and answers its public URL", async () => {
    const { app, bucket } = setup();
    const res = await request(app).post("/admin/images").set(admin).set("Content-Type", "image/webp").send(png);
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(ours);
    const stored = bucket.files.get(res.body.url.split("/").pop());
    expect(stored?.contentType).toBe("image/webp");
    expect(Buffer.from(stored!.body)).toEqual(png);
  });

  it("refuses another type, an empty body, and more than 5 MB", async () => {
    const { app, bucket } = setup();
    expect((await request(app).post("/admin/images").set(admin).set("Content-Type", "image/svg+xml").send("<svg/>")).status).toBe(400);
    expect((await request(app).post("/admin/images").set(admin).set("Content-Type", "image/png").send(Buffer.alloc(0))).status).toBe(400);
    const big = await request(app).post("/admin/images").set(admin).set("Content-Type", "image/png").send(Buffer.alloc(5 * 1024 * 1024 + 1));
    expect(big.status).toBe(413);
    expect(bucket.files.size).toBe(0);
  });
});

describe("storeLink (D17)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps one of our URLs as it is, without downloading", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const url = "https://images.example.test/abc.webp";
    expect(await storeLink(setup().store, url)).toBe(url);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("copies any other image link into R2", async () => {
    vi.stubGlobal("fetch", async () => new Response(png, { headers: { "Content-Type": "image/png" } }));
    const { store, bucket } = setup();
    const url = await storeLink(store, "https://shop.example/cap.png");
    expect(url).toMatch(ours);
    expect(bucket.files.size).toBe(1);
  });

  it.each([
    ["a page that isn't an image", new Response("<html>", { headers: { "Content-Type": "text/html" } })],
    ["a missing file", new Response("no", { status: 404 })],
    ["a file declared over 5 MB", new Response(png, { headers: { "Content-Type": "image/png", "Content-Length": String(6 * 1024 * 1024) } })],
  ])("refuses %s, storing nothing", async (_, response) => {
    vi.stubGlobal("fetch", async () => response);
    const { store, bucket } = setup();
    await expect(storeLink(store, "https://shop.example/x")).rejects.toMatchObject({ status: 400, code: "VALIDATION" });
    expect(bucket.files.size).toBe(0);
  });

  it("refuses a link that isn't http(s)", async () => {
    await expect(storeLink(setup().store, "ftp://shop.example/x.png")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
