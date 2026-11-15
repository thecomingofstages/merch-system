/** Run from the repo root: npx tsx apps/server/scripts/update-postcodes.ts */
import { mkdir, writeFile } from "node:fs/promises";
import { PostalCode, PostcodeLookupResponse } from "@merch/shared";
import { z } from "zod";

// Change this commit deliberately when refreshing the reviewed upstream snapshot.
const commit = "07319ed40eb3440c9a1b17cc48fa223340ddce55";
const base = `https://raw.githubusercontent.com/kongvut/thai-province-data/${commit}`;
const [source, license] = await Promise.all([
  fetch(`${base}/api/latest/province_with_district_and_sub_district.json`),
  fetch(`${base}/LICENSE`),
]);
if (!source.ok || !license.ok) throw new Error("Could not download the postcode source and license");

const area = z.object({ name: z.object({ th: z.string().min(1) }), deleted_at: z.string().nullable() });
const provinces = z.array(area.extend({
  districts: z.array(area.extend({
    sub_districts: z.array(area.extend({ zip_code: z.number().int().min(10000).max(99999) })),
  })),
})).min(1).parse(await source.json());

const postcodes: Record<string, PostcodeLookupResponse> = {};
for (const province of provinces) {
  if (province.deleted_at) continue;
  for (const district of province.districts) {
    if (district.deleted_at) continue;
    for (const tambon of district.sub_districts) {
      if (tambon.deleted_at) continue;
      const code = String(tambon.zip_code);
      (postcodes[code] ??= []).push({
        tambon: tambon.name.th,
        amphoe: district.name.th,
        province: province.name.th,
      });
    }
  }
}
for (const [code, places] of Object.entries(postcodes)) {
  PostalCode.parse(code);
  PostcodeLookupResponse.min(1).parse(places);
}
if (Object.keys(postcodes).length === 0) throw new Error("The postcode source is empty");

const directory = new URL("../src/app/data/", import.meta.url);
await mkdir(directory, { recursive: true });
// One postcode per line keeps the generated file compact and its updates reviewable.
const rows = Object.entries(postcodes).sort(([a], [b]) => a.localeCompare(b))
  .map(([code, places]) => `  ${JSON.stringify(code)}: ${JSON.stringify(places)}`);
await writeFile(new URL("postcodes.json", directory), `{\n${rows.join(",\n")}\n}\n`);
await writeFile(new URL("postcodes.LICENSE", directory), await license.text());
