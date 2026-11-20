import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatThaiAddress, PostcodeLookupResponse } from "@merch/shared";
import { buildTestApp } from "./helpers/app";

// A small copy of kongvut/thai-province-data's api/latest files, in their real shape.
const at = { created_at: "2019-08-09T03:33:09.000+07:00", updated_at: "2025-09-20T06:31:26.000+07:00", deleted_at: null };
const name = (th: string) => ({ th, en: th });
const source: Record<string, unknown[]> = {
  "province.json": [
    { id: 1, name: name("กรุงเทพมหานคร"), ...at },
    { id: 38, name: name("เชียงใหม่"), ...at },
  ],
  "district.json": [
    { id: 1007, name: name("ปทุมวัน"), province_id: 1, ...at },
    { id: 3801, name: name("เมืองเชียงใหม่"), province_id: 38, ...at },
  ],
  "sub_district.json": [
    { id: 100701, zip_code: 10330, name: name("รองเมือง"), district_id: 1007, ...at },
    { id: 100799, zip_code: 10330, name: name("ยุบแล้ว"), district_id: 1007, ...at, deleted_at: "2024-01-01T00:00:00.000+07:00" },
    { id: 100702, zip_code: 10330, name: name("วังใหม่"), district_id: 1007, ...at },
    { id: 380104, zip_code: 50200, name: name("สุเทพ"), district_id: 3801, ...at },
  ],
};

let fetched: string[];
const serve = (files: Record<string, unknown[]>, status = 200) =>
  vi.stubGlobal("fetch", async (url: string) => {
    fetched.push(url);
    return Response.json(files[url.split("/").pop()!] ?? null, { status });
  });

describe("GET /address/postcode/:code (2.2, live source)", () => {
  beforeEach(() => {
    fetched = [];
    serve(source);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns every live tambon of a Bangkok postcode from the latest source, skipping deleted ones", async () => {
    const res = await request(buildTestApp()).get("/address/postcode/10330");
    expect(res.status).toBe(200);
    expect(PostcodeLookupResponse.parse(res.body)).toEqual([
      { tambon: "รองเมือง", amphoe: "ปทุมวัน", province: "กรุงเทพมหานคร" },
      { tambon: "วังใหม่", amphoe: "ปทุมวัน", province: "กรุงเทพมหานคร" },
    ]);
    expect(formatThaiAddress({ details: "254 ถนนพญาไท", postal_code: "10330", ...res.body[1] }))
      .toBe("254 ถนนพญาไท แขวงวังใหม่ เขตปทุมวัน กรุงเทพมหานคร 10330");
    expect(fetched.every((url) => url.includes("/kongvut/thai-province-data/master/api/latest/"))).toBe(true);
  });

  it("formats a postcode outside Bangkok", async () => {
    const res = await request(buildTestApp()).get("/address/postcode/50200");
    expect(res.body).toEqual([{ tambon: "สุเทพ", amphoe: "เมืองเชียงใหม่", province: "เชียงใหม่" }]);
    expect(formatThaiAddress({ details: "239 ถนนห้วยแก้ว", postal_code: "50200", ...res.body[0] }))
      .toBe("239 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200");
  });

  it("returns an empty array for an unknown five-digit code", async () => {
    const res = await request(buildTestApp()).get("/address/postcode/00000");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it.each(["1033", "103300", "abcde", "1033a", "%2010330", "__proto__"])("rejects malformed code %s without calling the source", async (code) => {
    const res = await request(buildTestApp()).get(`/address/postcode/${code}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(fetched).toEqual([]);
  });

  it("answers 503 UNAVAILABLE when the source is down or sends a bad row", async () => {
    serve(source, 500);
    expect((await request(buildTestApp()).get("/address/postcode/10330")).body.error.code).toBe("UNAVAILABLE");

    const badRow = { ...source, "sub_district.json": [{ id: 1, zip_code: 10330, name: { th: "" }, district_id: 1007, ...at }] };
    serve(badRow);
    const res = await request(buildTestApp()).get("/address/postcode/10330");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("UNAVAILABLE");
  });
});
