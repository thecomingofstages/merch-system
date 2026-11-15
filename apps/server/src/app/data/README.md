# Thai postcode lookup (task 2.2)

`postcodes.json` is a generated index of the Thai names in
[kongvut/thai-province-data](https://github.com/kongvut/thai-province-data),
pinned to [07319ed40eb3440c9a1b17cc48fa223340ddce55](https://github.com/kongvut/thai-province-data/commit/07319ed40eb3440c9a1b17cc48fa223340ddce55).
Source file: `api/latest/province_with_district_and_sub_district.json`.
Its MIT notice is retained verbatim in `postcodes.LICENSE`.

The reviewed APIs did not offer a suitable hosted postcode lookup:
[Thai Address API](https://github.com/oadultradeepfield/thai-address-api) requires
self-hosting, and [Thailand Open APIs](https://github.com/mogohichi/thailand-open-apis)
documents administrative-area and coordinate searches. This bundled-data fallback needs no API key, database, runtime
file access, or outbound request. It is static data shipped in the Worker bundle.

The snapshot contains 7,436 subdistricts under 964 postcodes. Names are copied without
prefixes or transliteration. Bangkok is `กรุงเทพมหานคร`, matching `formatThaiAddress()`.
Each subdistrict has one postcode in this source; alternate delivery postcodes are
not represented. The data is a community snapshot, not live Thailand Post validation.

`GET /address/postcode/:code` returns every matching `{ tambon, amphoe, province }`.
Malformed codes return `400 VALIDATION` via the shared `PostalCode` schema.
A valid five-digit code with no matches returns `[]`.

To refresh, review the upstream changes, update the pinned commit in
`apps/server/scripts/update-postcodes.ts`, then run from the repository root:

```sh
npx tsx apps/server/scripts/update-postcodes.ts
npm run test -w apps/server
npm run typecheck -w apps/server
```

Review the generated data and license changes, update the counts and source commit
above, and run the server's Wrangler dry-run build before committing. Do not hand-edit
the JSON. No runtime cache or mutable data is used.
