/**
 * Postcode lookup (2.2, D16) from the live data of kongvut/thai-province-data (MIT), which
 * follows DOPA for names and Thailand Post for postcodes. Nothing is bundled, so upstream
 * fixes reach buyers within a day. Each postcode's answer is cached at the edge for a day:
 * the ~3 MB source is parsed only on a miss (~15 ms CPU), not on every lookup.
 */
import { PostalCode, type PostcodeLookupResponse } from "@merch/shared";
import { z } from "zod";
import { ApiError } from "../utils/ApiError";

const SOURCE = "https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest";
const DAY = 86_400;

// Third-party data: only the rows an answer uses are checked, which is all that reaches a buyer.
const area = { id: z.number().int(), name: z.object({ th: z.string().trim().min(1) }), deleted_at: z.string().nullable() };
const SubDistrict = z.object({ ...area, zip_code: z.number().int(), district_id: z.number().int() });
const District = z.object({ ...area, province_id: z.number().int() });
const Province = z.object(area);

async function rows(file: string): Promise<{ id?: unknown; zip_code?: unknown }[]> {
  const res = await fetch(`${SOURCE}/${file}.json`, { cf: { cacheTtl: DAY, cacheEverything: true } });
  if (!res.ok) throw new Error(`${file}.json: HTTP ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error(`${file}.json: not a list`);
  return data;
}

/** Every live { tambon, amphoe, province } with this postcode, in the source's order. */
async function fromSource(postal: string): Promise<PostcodeLookupResponse> {
  const [subs, districts, provinces] = await Promise.all([rows("sub_district"), rows("district"), rows("province")]);
  const byId = <T>(list: { id?: unknown }[], schema: z.ZodType<T>, id: number) => {
    const row = list.find((r) => r?.id === id);
    return row === undefined ? undefined : schema.parse(row);
  };
  return subs
    .filter((r) => r?.zip_code === Number(postal))
    .map((r) => SubDistrict.parse(r))
    .flatMap((tambon) => {
      const district = byId(districts, District, tambon.district_id);
      const province = district && byId(provinces, Province, district.province_id);
      if (tambon.deleted_at || !district || district.deleted_at || !province || province.deleted_at) return [];
      return [{ tambon: tambon.name.th, amphoe: district.name.th, province: province.name.th }];
    });
}

export async function lookupPostcode(code: unknown): Promise<PostcodeLookupResponse> {
  const postal = PostalCode.parse(code);
  // The Cache API exists on Workers only; the Node tests run without it.
  const cache = typeof caches === "undefined" ? undefined : caches.default;
  const key = new Request(`${SOURCE}/postcode/${postal}`);
  const hit = await cache?.match(key);
  if (hit) return hit.json();

  let places: PostcodeLookupResponse;
  try {
    places = await fromSource(postal);
  } catch (err) {
    console.error("Postcode source unavailable", err);
    throw ApiError.unavailable("The postcode lookup is unavailable, try again");
  }
  await cache?.put(key, Response.json(places, { headers: { "Cache-Control": `max-age=${DAY}` } }));
  return places;
}
