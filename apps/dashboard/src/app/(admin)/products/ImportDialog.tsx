"use client";

import { IMPORT_COLUMNS, type ImportError, type ImportRequest, parseCatalogSheet, readXlsxRows, writeXlsx } from "@merch/shared";
import { Button, Dialog, Input } from "@merch/ui";
import { useState } from "react";
import { importCatalog } from "@/lib/api";
import { COPY } from "./copy";
import { mapDashboardError } from "./helpers";

/**
 * Import shops, products and variants from a Google Sheets / Excel .xlsx (D19). The sheet is
 * read and checked in the browser, the admin sees what will be created or what to fix, and
 * only then is it sent; the server checks again and saves it all or nothing.
 */
export function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (notice: string) => Promise<void> }) {
  return (
    <div className="[&_dialog]:max-w-2xl">
      <Dialog open={open} onClose={onClose} title={COPY.importTitle}>
        {open ? <ImportBody onClose={onClose} onDone={onDone} /> : null}
      </Dialog>
    </div>
  );
}

function downloadTemplate() {
  const file = new Blob([writeXlsx([[...IMPORT_COLUMNS]], "Products").slice()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: "merch-import-template.xlsx" });
  link.click();
  URL.revokeObjectURL(link.href);
}

function ImportBody({ onClose, onDone }: { onClose: () => void; onDone: (notice: string) => Promise<void> }) {
  const [reading, setReading] = useState(false);
  const [sheet, setSheet] = useState<{ request: ImportRequest | null; errors: ImportError[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(file: File | undefined) {
    setSheet(null);
    setError(null);
    if (!file) return;
    setReading(true);
    try {
      setSheet(parseCatalogSheet(await readXlsxRows(await file.arrayBuffer())));
    } catch {
      setError(COPY.importUnreadable);
    } finally {
      setReading(false);
    }
  }

  async function submit() {
    if (!sheet?.request) return;
    setSaving(true);
    setError(null);
    try {
      const result = await importCatalog(sheet.request);
      await onDone(COPY.importDone(result));
      onClose();
    } catch (err) {
      setError(mapDashboardError(err));
    } finally {
      setSaving(false);
    }
  }

  const request = sheet?.request;
  const counts = request && {
    shops: request.shops.length,
    products: request.shops.reduce((n, s) => n + s.products.length, 0),
    variants: request.shops.reduce((n, s) => n + s.products.reduce((m, p) => m + p.variants.length, 0), 0),
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-fg-2">{COPY.importIntro}</p>
      <div>
        <Button variant="secondary" onClick={downloadTemplate}>
          {COPY.importTemplate}
        </Button>
      </div>
      <Input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        label={COPY.importFile}
        disabled={saving}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = ""; // the same file, fixed and picked again, still fires
        }}
      />
      {reading ? <p className="text-small text-fg-2">{COPY.importReading}</p> : null}

      {sheet && sheet.errors.length > 0 ? (
        <div role="alert" className="text-small text-danger">
          <p className="font-semibold">{COPY.importErrors(sheet.errors.length)}</p>
          <ul className="mt-1 max-h-60 list-disc overflow-y-auto pl-5">
            {sheet.errors.map((e, i) => (
              <li key={i}>{COPY.importRow(e.row, e.message)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {counts ? <p className="text-small text-fg">{COPY.importSummary(counts.shops, counts.products, counts.variants)}</p> : null}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button disabled={!request || saving} onClick={submit}>
          {saving ? COPY.saving : COPY.importSubmit}
        </Button>
      </div>
    </div>
  );
}
