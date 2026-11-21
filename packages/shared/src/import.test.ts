import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, parseCatalogSheet } from "./import";
import { readXlsxRows, writeXlsx, type SheetRow } from "./xlsx";

/** A zip with deflated entries, as Google Sheets and Excel write them. */
function deflatedZip(files: [string, string][]): Uint8Array {
  const parts: Buffer[] = [];
  const dir: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const n = Buffer.from(name);
    const raw = Buffer.from(text);
    const data = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    parts.push(local, n, data);
    dir.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const size = dir.reduce((s, d) => s + d.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, ...dir, end]));
}

describe("readXlsxRows", () => {
  it("reads back what writeXlsx wrote, Thai and escaped characters included", async () => {
    const rows = [["shop", "product"], ["ร้าน A & B", 'หมวก "<แดง>"']];
    expect((await readXlsxRows(writeXlsx(rows))).map((r) => r.cells)).toEqual(rows);
  });

  it("reads a workbook as Google Sheets exports it: shared strings, numbers, booleans, gaps, deflate", async () => {
    const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const file = deflatedZip([
      ["xl/workbook.xml", `<workbook ${ns} xmlns:r="r"><sheets><sheet name="Shop" sheetId="7" r:id="rId3"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", '<Relationships><Relationship Target="/xl/worksheets/sheet7.xml" Id="rId3" /></Relationships>'],
      ["xl/sharedStrings.xml", "<sst><si><t>shop</t></si><si><r><t>เสื้อ</t></r><r><t xml:space=\"preserve\"> ลาย A</t></r></si><si><t>a&amp;b</t></si></sst>"],
      [
        "xl/worksheets/sheet7.xml",
        `<worksheet ${ns}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"/>` +
          `<row r="4"><c r="A4" t="s"><v>1</v></c><c r="B4"><v>190</v></c><c r="C4" t="b"><v>0</v></c><c r="D4" t="str"><f>A1</f><v>x</v></c></row></sheetData></worksheet>`,
      ],
    ]);
    expect(await readXlsxRows(file)).toEqual([
      { row: 1, cells: ["shop", "", "a&b"] },
      { row: 4, cells: ["เสื้อ ลาย A", "190", "FALSE", "x"] },
    ]);
  });

  it("refuses a file that isn't an .xlsx", async () => {
    await expect(readXlsxRows(new TextEncoder().encode("shop,product\nA,B"))).rejects.toThrow("Not an .xlsx file");
  });
});

describe("parseCatalogSheet", () => {
  const sheet = (...data: string[][]): SheetRow[] => [{ row: 1, cells: [...IMPORT_COLUMNS] }, ...data.map((cells, i) => ({ row: i + 2, cells }))];
  //               shop    product  variant price stock limit visible desc  images                       variant_image
  const row = (...cells: string[]) => cells;

  it("groups rows into shops, products and variants, repeating empty shop and product cells from above", () => {
    const { request, errors } = parseCatalogSheet(
      sheet(
        row("A", "Cap", "Red", "190", "8", "2", "", "Red cap", "https://x.test/cap.png https://x.test/cap2.png"),
        row("", "", "Black", "190", "12", "", "no"),
        row("", "Shirt", "S", "250", "", "", "TRUE", "", "", "https://x.test/s.png"),
        row("B", "Bag", "Single", "119", "25"),
      ),
    );
    expect(errors).toEqual([]);
    expect(request).toEqual({
      shops: [
        {
          shop_name: "A",
          products: [
            {
              name: "Cap",
              description: "Red cap",
              image: ["https://x.test/cap.png", "https://x.test/cap2.png"],
              variants: [
                { name: "Red", price: 190, online_stock: 8, buy_limit: 2, visible_to_online: true, image: null },
                { name: "Black", price: 190, online_stock: 12, buy_limit: 0, visible_to_online: false, image: null },
              ],
            },
            {
              name: "Shirt",
              description: "",
              image: [],
              variants: [{ name: "S", price: 250, online_stock: 0, buy_limit: 0, visible_to_online: true, image: "https://x.test/s.png" }],
            },
          ],
        },
        { shop_name: "B", products: [{ name: "Bag", description: "", image: [], variants: [{ name: "Single", price: 119, online_stock: 25, buy_limit: 0, visible_to_online: true, image: null }] }] },
      ],
    });
  });

  it("treats a shop name repeated on each row like an empty one: the product still carries on", () => {
    const { request, errors } = parseCatalogSheet(sheet(row("A", "Cap", "Red", "190"), row("A", "", "Black", "190"), row("B", "", "X", "1")));
    expect(errors).toEqual([{ row: 4, message: "product is empty" }]);
    expect(request).toBeNull();
    const ok = parseCatalogSheet(sheet(row("A", "Cap", "Red", "190"), row("A", "", "Black", "190")));
    expect(ok.request!.shops[0]!.products[0]!.variants.map((v) => v.name)).toEqual(["Red", "Black"]);
  });

  it("gives each problem its sheet row, and no request", () => {
    const { request, errors } = parseCatalogSheet(
      sheet(
        row("A", "Cap", "Red", "19.5"),
        row("", "", "", "100"),
        row("", "", "Blue", "100", "-1", "", "maybe"),
        row("", "", "Green", "100", "", "", "", "Another description"),
        row("", "Shirt", "S", "250", "", "", "", "", "not a link"),
        row("B", "", "X", "1"),
      ),
    );
    expect(request).toBeNull();
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4, 4, 6, 7]);
    expect(errors.find((e) => e.row === 7)!.message).toBe("product is empty");
    expect(errors.filter((e) => e.row === 2 || e.row === 4).map((e) => e.message)).toEqual([
      "price must be a whole number of baht (0 or more)",
      "online_stock must be a whole number (0 or more)",
      "visible_to_online must be TRUE or FALSE",
    ]);
  });

  it("says which required columns are missing", () => {
    const { errors } = parseCatalogSheet([{ row: 1, cells: ["shop", "variant"] }, { row: 2, cells: ["A", "Red"] }]);
    expect(errors).toEqual([{ row: 1, message: "Missing columns: product, price" }]);
  });
});
