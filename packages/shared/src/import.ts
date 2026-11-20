/**
 * Turns the rows of an import sheet (D19) into an ImportRequest, or row-numbered errors.
 * One row per variant; empty shop, product, description and product_images cells repeat the
 * row above, so merged cells exported from Google Sheets work.
 */
import type { z } from "zod";
import { ImportProduct, ImportRequest, ImportVariant } from "./schemas/import";
import type { SheetRow } from "./xlsx";

/** The template's header row, in order. Only the first four are required. */
export const IMPORT_COLUMNS = [
  "shop",
  "product",
  "variant",
  "price",
  "online_stock",
  "buy_limit",
  "visible_to_online",
  "description",
  "product_images",
  "variant_image",
] as const;
const REQUIRED = ["shop", "product", "variant", "price"] as const;

export type ImportError = { row: number; message: string };

/** Problems in the sheet's own words: the column name, and what it should hold. */
const PROBLEM: Record<string, string> = {
  name: "variant is empty",
  price: "price must be a whole number of baht (0 or more)",
  online_stock: "online_stock must be a whole number (0 or more)",
  buy_limit: "buy_limit must be a whole number (0 = no limit)",
  visible_to_online: "visible_to_online must be TRUE or FALSE",
  image: "variant_image must be a link starting with http:// or https://",
};

const urls = (cell: string) => cell.split(/[\s,]+/).filter(Boolean);
const whole = (cell: string, fallback: number) => (cell === "" ? fallback : /^\d+$/.test(cell) ? Number(cell) : NaN);
const yes = (cell: string) => {
  const v = cell.toLowerCase();
  return v === "" || ["true", "yes", "y", "1", "ใช่"].includes(v) ? true : ["false", "no", "n", "0", "ไม่"].includes(v) ? false : null;
};

export function parseCatalogSheet(rows: SheetRow[]): { request: ImportRequest | null; errors: ImportError[] } {
  const [header, ...data] = rows;
  if (!header) return { request: null, errors: [{ row: 1, message: "The sheet is empty" }] };
  const col = new Map(header.cells.map((name, i) => [name.trim().toLowerCase(), i]));
  const missing = REQUIRED.filter((c) => !col.has(c));
  if (missing.length) return { request: null, errors: [{ row: header.row, message: `Missing columns: ${missing.join(", ")}` }] };
  const cell = (r: SheetRow, name: (typeof IMPORT_COLUMNS)[number]) => (col.has(name) ? (r.cells[col.get(name)!] ?? "").trim() : "");

  const errors: ImportError[] = [];
  type Entry = { first: number; description: string; image: string[]; variants: z.output<typeof ImportVariant>[] };
  const shops = new Map<string, Map<string, Entry>>();
  let shop = "";
  let product = "";
  for (const r of data) {
    const shopCell = cell(r, "shop");
    const productCell = cell(r, "product");
    if (shopCell) shop = shopCell;
    // A new shop starts its own products: an empty product cell only repeats within the same shop.
    product = productCell || (shopCell ? "" : product);
    if (!shop || !product) {
      errors.push({ row: r.row, message: !shop ? "shop is empty" : "product is empty" });
      continue;
    }
    const products = shops.get(shop) ?? new Map();
    shops.set(shop, products);
    const entry: Entry = products.get(product) ?? { first: r.row, description: "", image: [], variants: [] };
    products.set(product, entry);

    for (const [name, value, current] of [
      ["description", cell(r, "description"), entry.description],
      ["product_images", urls(cell(r, "product_images")).join(" "), entry.image.join(" ")],
    ] as const) {
      if (value && current && value !== current) errors.push({ row: r.row, message: `${name} differs from row ${entry.first} for the same product` });
    }
    entry.description ||= cell(r, "description");
    if (entry.image.length === 0) entry.image = urls(cell(r, "product_images"));

    const visible = yes(cell(r, "visible_to_online"));
    const variant = ImportVariant.safeParse({
      name: cell(r, "variant"),
      price: whole(cell(r, "price"), NaN),
      online_stock: whole(cell(r, "online_stock"), 0),
      buy_limit: whole(cell(r, "buy_limit"), 0),
      visible_to_online: visible ?? "",
      image: cell(r, "variant_image") || null,
    });
    if (!variant.success) {
      const messages = new Set(variant.error.issues.map((i) => PROBLEM[String(i.path[0])] ?? `${i.path.join(".")}: ${i.message}`));
      for (const message of messages) errors.push({ row: r.row, message });
    } else entry.variants.push(variant.data);
  }

  const request = {
    shops: [...shops].map(([shop_name, products]) => ({
      shop_name,
      products: [...products].map(([name, p]) => ({ name, description: p.description, image: p.image, variants: p.variants })),
    })),
  };
  // Product-level checks (image links) with the row where the product starts.
  for (const [, products] of shops) {
    for (const [name, p] of products) {
      const parsed = ImportProduct.safeParse({ name, description: p.description, image: p.image, variants: p.variants });
      if (!parsed.success) {
        // Once per field: three bad links in one cell are one problem.
        const field = (key: string) =>
          key === "image" ? "product_images must be links starting with http:// or https://" : key === "name" ? "product is empty" : `${key}: invalid`;
        const messages = new Set(parsed.error.issues.filter((i) => i.path[0] !== "variants").map((i) => field(String(i.path[0]))));
        for (const message of messages) errors.push({ row: p.first, message });
      }
    }
  }
  if (data.length === 0) errors.push({ row: header.row, message: "No rows under the header" });
  // By row, then left to right across the sheet: every message starts with its column's name.
  const column = (e: ImportError) => {
    const i = (IMPORT_COLUMNS as readonly string[]).indexOf(e.message.split(/[ :]/)[0]!);
    return i < 0 ? IMPORT_COLUMNS.length : i;
  };
  errors.sort((a, b) => a.row - b.row || column(a) - column(b));
  const parsed = ImportRequest.safeParse(request);
  return errors.length || !parsed.success ? { request: null, errors } : { request: parsed.data, errors };
}
