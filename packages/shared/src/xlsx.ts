/**
 * A minimal .xlsx reader and writer (D19), enough for one sheet of text and numbers, as Google
 * Sheets and Excel export it. An .xlsx is a zip of XML files: the zip is read here, entries are
 * inflated with the platform's DecompressionStream (browsers, Node 18+), and the XML is read with
 * small patterns. Formulas give their cached value; styles, dates and merged cells are ignored.
 */

export type SheetRow = { row: number; cells: string[] };

const utf8 = new TextDecoder();

/** Every entry of a zip, by name, still compressed. */
function zipEntries(bytes: Uint8Array): Map<string, { method: number; data: Uint8Array }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Not an .xlsx file (no zip directory found)");
  const entries = new Map<string, { method: number; data: Uint8Array }>();
  let p = view.getUint32(end + 16, true);
  for (let n = view.getUint16(end + 10, true); n > 0; n--) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("Not an .xlsx file (broken zip directory)");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    entries.set(name, { method, data: bytes.subarray(start, start + size) });
    p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return entries;
}

async function inflate(entry: { method: number; data: Uint8Array }): Promise<string> {
  if (entry.method === 0) return utf8.decode(entry.data);
  if (entry.method !== 8) throw new Error(`Unsupported zip compression (method ${entry.method})`);
  const stream = new Blob([entry.data.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return utf8.decode(await new Response(stream).arrayBuffer());
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) =>
    code[0] === "#"
      ? String.fromCodePoint(code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
      : (ENTITIES[code] ?? whole),
  );

/** All the text runs (<t>) inside a piece of XML, joined. */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1]!)).join("");

const attribute = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

/** "A" → 0, "AB" → 27. */
const columnIndex = (ref: string) => [...ref.replace(/\d+$/, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** The first sheet's rows, every cell as text, in sheet order. Empty rows are left out; each row keeps its sheet number. */
export async function readXlsxRows(file: ArrayBuffer | Uint8Array): Promise<SheetRow[]> {
  const entries = zipEntries(file instanceof Uint8Array ? file : new Uint8Array(file));
  const read = async (name: string) => {
    const entry = entries.get(name);
    return entry ? inflate(entry) : null;
  };

  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("Not an .xlsx file (no workbook)");
  const firstSheet = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  // Attributes come in any order (openpyxl writes Target before Id), so find the element first.
  const target = [...rels.matchAll(/<Relationship\b([^>]*)>/g)]
    .map(([, attrs]) => attrs!)
    .find((attrs) => attribute(attrs, "Id") === firstSheet);
  const targetPath = target && attribute(target, "Target");
  const sheetXml = targetPath && (await read(targetPath.startsWith("/") ? targetPath.slice(1) : `xl/${targetPath}`));
  if (!sheetXml) throw new Error("Not an .xlsx file (no first sheet)");

  const shared = [...((await read("xl/sharedStrings.xml")) ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));

  const rows: SheetRow[] = [];
  for (const [, rowAttrs, rowXml] of sheetXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = [];
    for (const [, attrs, inner = ""] of (rowXml ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attribute(attrs!, "r");
      const type = attribute(attrs!, "t");
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const text =
        type === "s" ? (shared[Number(v)] ?? "")
        : type === "inlineStr" ? textOf(inner)
        : type === "b" ? (v === "1" ? "TRUE" : "FALSE")
        : unescape(v ?? "");
      cells[ref ? columnIndex(ref) : cells.length] = text.trim();
    }
    const filled = Array.from(cells, (c) => c ?? "");
    if (filled.some((c) => c !== "")) rows.push({ row: Number(attribute(rowAttrs!, "r")) || rows.length + 1, cells: filled });
  }
  return rows;
}

// Writer: one sheet of text cells, stored (uncompressed) in the zip. Used for the import template.

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(files: [string, string][]): Uint8Array {
  const utf8Encode = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = utf8Encode.encode(name);
    const data = utf8Encode.encode(text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    directory.push(new Uint8Array(central.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directorySize = directory.reduce((n, d) => n + d.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  const out = new Uint8Array(offset + directorySize + 22);
  let at = 0;
  for (const part of [...parts, ...directory, new Uint8Array(end.buffer)]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
const columnName = (i: number): string => (i >= 26 ? columnName(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

/** A one-sheet .xlsx of text cells, that Google Sheets and Excel open. */
export function writeXlsx(rows: string[][], sheetName = "Sheet1"): Uint8Array {
  const sheetRows = rows
    .map((cells, r) => {
      const xml = cells
        .map((text, c) => `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escape(text)}</t></is></c>`)
        .join("");
      return `<row r="${r + 1}">${xml}</row>`;
    })
    .join("");
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  return zip([
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relNs}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8"?><workbook ${ns} xmlns:r="${relNs}"><sheets><sheet name="${escape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relNs}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet ${ns}><sheetData>${sheetRows}</sheetData></worksheet>`],
  ]);
}
