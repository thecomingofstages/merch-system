"use client";

import { type Product, type Promotion, PromotionRequest, type Shop } from "@merch/shared";
import { Button, Dialog, Input, Price, Select } from "@merch/ui";
import { useEffect, useState, type FormEvent } from "react";
import { mapDashboardError } from "@/app/(admin)/products/helpers";
import { archivePromotion, listProducts, listPromotions, listShops, savePromotion } from "@/lib/api";
import { UploadImageButton } from "@/components/UploadImageButton";
import { COPY } from "./copy";

/** The form's fields as typed; numbers stay strings until Save checks them. */
type Draft = {
  name: string;
  description: string;
  image: string;
  price: string;
  active: boolean;
  items: { product_id: string; variant_ids: string[]; count: string }[];
};

const emptyItem = () => ({ product_id: "", variant_ids: [], count: "1" });
const emptyDraft = (): Draft => ({ name: "", description: "", image: "", price: "", active: true, items: [emptyItem()] });

const toDraft = (p: Promotion): Draft => ({
  name: p.name,
  description: p.description ?? "",
  image: p.image ?? "",
  price: String(p.price),
  active: p.active ?? true,
  items: p.items.map((i) => ({ product_id: i.product_id, variant_ids: [...i.variant_ids], count: String(i.count) })),
});

const toRequest = (d: Draft): PromotionRequest => ({
  name: d.name,
  description: d.description,
  image: d.image.trim() || null,
  // Number("") is 0: an empty price must fail, not make a free set.
  price: d.price.trim() === "" ? NaN : Number(d.price),
  active: d.active,
  items: d.items.map((i) => ({ product_id: i.product_id, variant_ids: i.variant_ids, count: Number(i.count) })),
});

export default function PromotionsPage() {
  const [sets, setSets] = useState<Promotion[] | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPromotions(), listShops(), listProducts()]).then(
      ([s, sh, pr]) => {
        if (cancelled) return;
        setSets(s);
        setShops(sh);
        setProducts(pr);
        setError(null);
      },
      (err: unknown) => {
        const msg = mapDashboardError(err);
        if (!cancelled && msg) setError(msg);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const refresh = () => setReload((n) => n + 1);

  async function toggle(p: Promotion) {
    try {
      await savePromotion(p._id, toRequest({ ...toDraft(p), active: !p.active }));
      refresh();
    } catch (err) {
      const msg = mapDashboardError(err);
      if (msg) setError(msg);
    }
  }

  const itemText = (item: Promotion["items"][number]) => {
    const product = products.find((p) => p._id === item.product_id);
    const names = item.variant_ids.map((id) => product?.variants.find((v) => v._id === id)?.name ?? id);
    return `${product?.name ?? item.product_id} ×${item.count} (${names.join(" / ")})`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold text-fg">{COPY.pageTitle}</h1>
          <p className="text-small text-fg-2">{COPY.intro}</p>
        </div>
        <Button onClick={() => setEditing({ id: null, draft: emptyDraft() })}>{COPY.newSet}</Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger bg-surface p-4 text-small text-danger">
          {error}
        </p>
      ) : null}

      {sets === null ? (
        <p className="text-small text-fg-2">{COPY.loading}</p>
      ) : sets.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-small text-fg-2">{COPY.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full border-collapse text-left text-small">
            <caption className="sr-only">{COPY.tableCaption}</caption>
            <thead>
              <tr className="border-b border-line bg-raised text-fg">
                <th scope="col" className="px-4 py-3 font-semibold">{COPY.colName}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{COPY.colItems}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{COPY.colPrice}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{COPY.colActive}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{COPY.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((p) => (
                <tr key={p._id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <ul>
                      {p.items.map((item, i) => (
                        <li key={i}>{itemText(item)}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <Price amount={p.price} />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={p.active ?? true}
                      onChange={() => toggle(p)}
                      aria-label={`${COPY.colActive}: ${p.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setEditing({ id: p._id, draft: toDraft(p) })}>
                        {COPY.edit}
                      </Button>
                      <Button variant="secondary" onClick={() => setDeleting(p)}>
                        {COPY.delete}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="[&_h2]:font-text [&_h2]:font-semibold">
        <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? COPY.editTitle : COPY.createTitle}>
          {editing ? (
            <SetForm
              key={editing.id ?? "new"}
              id={editing.id}
              initial={editing.draft}
              shops={shops}
              products={products}
              onDone={() => {
                setEditing(null);
                refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </Dialog>
        <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={COPY.deleteTitle}>
          {deleting ? (
            <DeleteBody
              set={deleting}
              onDone={() => {
                setDeleting(null);
                refresh();
              }}
              onCancel={() => setDeleting(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </div>
  );
}

function SetForm({
  id,
  initial,
  shops,
  products,
  onDone,
  onCancel,
}: {
  id: string | null;
  initial: Draft;
  shops: Shop[];
  products: Product[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setItem = (i: number, patch: Partial<Draft["items"][number]>) =>
    set({ items: draft.items.map((item, j) => (j === i ? { ...item, ...patch } : item)) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = PromotionRequest.safeParse(toRequest(draft));
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      setError(COPY.invalid(issue.path.join("."), issue.message));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePromotion(id, parsed.data);
      onDone();
    } catch (err) {
      const msg = mapDashboardError(err);
      if (msg) setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
      <Input label={COPY.name} value={draft.name} onChange={(e) => set({ name: e.target.value })} required />
      <Input label={COPY.description} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input label={COPY.image} type="url" value={draft.image} onChange={(e) => set({ image: e.target.value })} />
        </div>
        <UploadImageButton onUploaded={(url) => set({ image: url })} />
      </div>
      <Input label={COPY.price} inputMode="numeric" value={draft.price} onChange={(e) => set({ price: e.target.value })} required />
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="size-5" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
        {COPY.active}
      </label>

      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-2 font-semibold">{COPY.itemsLegend}</legend>
        {draft.items.map((item, i) => {
          const product = products.find((p) => p._id === item.product_id);
          return (
            <fieldset key={i} className="flex min-w-0 flex-col gap-3 rounded-lg border border-line p-3">
              <legend className="px-1 text-small font-medium">{COPY.item(i + 1)}</legend>
              <Select
                label={COPY.product}
                value={item.product_id}
                onChange={(e) => setItem(i, { product_id: e.target.value, variant_ids: [] })}
              >
                <option value="">{COPY.chooseProduct}</option>
                {shops.map((shop) => (
                  <optgroup key={shop._id} label={shop.shop_name}>
                    {products
                      .filter((p) => p.shop_id === shop._id)
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              {product ? (
                <fieldset className="flex flex-col gap-1">
                  <legend className="text-small font-medium">{COPY.variants}</legend>
                  {product.variants
                    .filter((v) => !v.archived)
                    .map((v) => (
                      <label key={v._id} className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={item.variant_ids.includes(v._id)}
                          onChange={(e) =>
                            setItem(i, {
                              variant_ids: e.target.checked
                                ? [...item.variant_ids, v._id]
                                : item.variant_ids.filter((x) => x !== v._id),
                            })
                          }
                        />
                        {v.name}
                      </label>
                    ))}
                </fieldset>
              ) : null}
              <Input label={COPY.count} inputMode="numeric" value={item.count} onChange={(e) => setItem(i, { count: e.target.value })} />
              {draft.items.length > 1 ? (
                <Button variant="secondary" onClick={() => set({ items: draft.items.filter((_, j) => j !== i) })}>
                  {COPY.removeItem}
                </Button>
              ) : null}
            </fieldset>
          );
        })}
        <Button variant="secondary" onClick={() => set({ items: [...draft.items, emptyItem()] })}>
          {COPY.addItem}
        </Button>
      </fieldset>

      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          {COPY.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
}

function DeleteBody({
  set,
  onDone,
  onCancel,
}: {
  set: Promotion;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await archivePromotion(set._id);
      onDone();
    } catch (err) {
      const msg = mapDashboardError(err);
      if (msg) setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold">{set.name}</p>
      <p className="text-small text-fg-2">{COPY.deleteBody}</p>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          {COPY.cancel}
        </Button>
        <Button disabled={saving} onClick={confirm}>
          {saving ? COPY.saving : COPY.delete}
        </Button>
      </div>
    </div>
  );
}
