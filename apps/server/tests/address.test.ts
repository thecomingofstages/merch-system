import request from "supertest";
import { describe, expect, it } from "vitest";
import { formatThaiAddress, PostalCode, PostcodeLookupResponse } from "@merch/shared";
import data from "../src/app/data/postcodes.json";
import { buildTestApp } from "./helpers/app";

describe("GET /address/postcode/:code (2.2)", () => {
  it("returns all four Bangkok subdistricts for 10330 without auth or a database", async () => {
    const res = await request(buildTestApp()).get("/address/postcode/10330");
    expect(res.status).toBe(200);
    expect(PostcodeLookupResponse.parse(res.body)).toEqual([
      { tambon: "รองเมือง", amphoe: "ปทุมวัน", province: "กรุงเทพมหานคร" },
      { tambon: "วังใหม่", amphoe: "ปทุมวัน", province: "กรุงเทพมหานคร" },
      { tambon: "ปทุมวัน", amphoe: "ปทุมวัน", province: "กรุงเทพมหานคร" },
      { tambon: "ลุมพินี", amphoe: "ปทุมวัน", province: "กรุงเทพมหานคร" },
    ]);
    expect(formatThaiAddress({ details: "254 ถนนพญาไท", postal_code: "10330", ...res.body[1] }))
      .toBe("254 ถนนพญาไท แขวงวังใหม่ เขตปทุมวัน กรุงเทพมหานคร 10330");
  });

  it("returns all matches outside Bangkok with names that format correctly", async () => {
    const res = await request(buildTestApp()).get("/address/postcode/50200");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { tambon: "ศรีภูมิ", amphoe: "เมืองเชียงใหม่", province: "เชียงใหม่" },
      { tambon: "พระสิงห์", amphoe: "เมืองเชียงใหม่", province: "เชียงใหม่" },
      { tambon: "สุเทพ", amphoe: "เมืองเชียงใหม่", province: "เชียงใหม่" },
    ]);
    expect(formatThaiAddress({ details: "239 ถนนห้วยแก้ว", postal_code: "50200", ...res.body[2] }))
      .toBe("239 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200");
  });

  it("returns an empty array for an unknown five-digit code", async () => {
    const res = await request(buildTestApp()).get("/address/postcode/00000");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it.each(["1033", "103300", "abcde", "1033a", "%2010330", "__proto__"])("rejects malformed code %s", async (code) => {
    const res = await request(buildTestApp()).get(`/address/postcode/${code}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("keeps every bundled code and response compatible with the shared schemas, with no duplicate choices", () => {
    expect(Object.keys(data)).toHaveLength(964);
    expect(Object.values(data).flat()).toHaveLength(7436);
    for (const [code, places] of Object.entries(data)) {
      expect(PostalCode.safeParse(code).success).toBe(true);
      expect(PostcodeLookupResponse.nonempty().safeParse(places).success).toBe(true);
      expect(new Set(places.map((place) => JSON.stringify(place))).size).toBe(places.length);
    }
  });
});
