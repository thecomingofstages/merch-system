"use client";

import type { CatalogPromotion, QuotePromotion } from "@merch/shared";
import { useState } from "react";
import { Bilingual } from "./Bilingual";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Price } from "./Price";
import { QuantityStepper } from "./QuantityStepper";

type CatalogSetItem = CatalogPromotion["items"][number];
/** The fields the set parts read. Stock comes from `stockOf`, so client and POS variants both fit. */
export type SetVariant = Pick<CatalogSetItem["variants"][number], "_id" | "name" | "image">;
export type ShopPromotion<V extends SetVariant = SetVariant> = Omit<CatalogPromotion, "items" | "sold_out"> & {
  items: (Omit<CatalogSetItem, "variants"> & { variants: V[] })[];
};

/** True when some item can't be filled from the stock left. */
export const setSoldOut = <V extends SetVariant>(promotion: ShopPromotion<V>, stockOf: (variant: V) => number) =>
  promotion.items.some((item) => item.variants.reduce((sum, v) => sum + Math.max(stockOf(v), 0), 0) < item.count);

/** The most of one variant a buyer can still pick for an item: its stock, and what the item still needs. */
export function pickMax(stock: number, picked: number, itemCount: number, itemPicked: number): number {
  return Math.max(Math.min(stock, picked + itemCount - itemPicked), 0);
}

type PromotionPopupProps<V extends SetVariant> = {
  /** The set to show; null closes the popup. */
  promotion: ShopPromotion<V> | null;
  /** Client passes `online_stock`, POS passes `pos_stock`. */
  stockOf: (variant: V) => number;
  /** The set with the pieces chosen; the price is the set's, the server checks it again. */
  onAdd: (set: QuotePromotion) => void;
  onClose: () => void;
};

/** A set's details: for each item, the buyer picks its variants, mixing them, up to the item's count (D13). */
export function PromotionPopup<V extends SetVariant>({ promotion, stockOf, onAdd, onClose }: PromotionPopupProps<V>) {
  return (
    <Dialog open={promotion !== null} onClose={onClose} title={promotion?.name ?? ""} sheet>
      {/* key: another set starts with nothing picked */}
      {promotion ? <PopupBody key={promotion._id} promotion={promotion} stockOf={stockOf} onAdd={onAdd} /> : null}
    </Dialog>
  );
}

function PopupBody<V extends SetVariant>({
  promotion,
  stockOf,
  onAdd,
}: Pick<PromotionPopupProps<V>, "stockOf" | "onAdd"> & { promotion: ShopPromotion<V> }) {
  // counts[i][variantId]: how many of that variant are picked for item i.
  const [counts, setCounts] = useState<Record<string, number>[]>(() => promotion.items.map(() => ({})));
  const picked = (i: number) => Object.values(counts[i] ?? {}).reduce((sum, n) => sum + n, 0);
  const complete = promotion.items.every((item, i) => picked(i) === item.count);

  function add() {
    onAdd({
      promotion_id: promotion._id,
      name: promotion.name,
      price: promotion.price,
      picks: promotion.items.map((item, i) =>
        item.variants
          .filter((v) => (counts[i]?.[v._id] ?? 0) > 0)
          .map((v) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            variant_id: v._id,
            variant_name: v.name,
            count: counts[i]![v._id]!,
          })),
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {promotion.image ? <img src={promotion.image} alt={promotion.name} className="aspect-square w-full rounded-sm object-cover" /> : null}
      {promotion.description ? <p>{promotion.description}</p> : null}
      {promotion.items.map((item, i) => (
        <fieldset key={i} className="flex min-w-0 flex-col gap-2 border-t border-line pt-3">
          <legend className="font-medium">
            {item.product_name}: <Bilingual th={`เลือก ${item.count} ชิ้น`} en={`Pick ${item.count}`} />
          </legend>
          <p aria-live="polite" className="text-small">
            <Bilingual th={`เลือกแล้ว ${picked(i)} จาก ${item.count}`} en={`${picked(i)} of ${item.count} picked`} />
          </p>
          {item.variants.map((v) => {
            const value = counts[i]?.[v._id] ?? 0;
            const max = pickMax(stockOf(v), value, item.count, picked(i));
            return (
              <div key={v._id} className="flex items-center justify-between gap-4">
                <span>
                  {v.name}
                  {stockOf(v) <= 0 ? <> · <Bilingual th="สินค้าหมด" en="Sold out" /></> : null}
                </span>
                <QuantityStepper
                  value={value}
                  min={0}
                  max={max}
                  decreaseLabel={`ลด ${v.name}`}
                  increaseLabel={`เพิ่ม ${v.name}`}
                  onChange={(n) => setCounts((all) => all.map((c, j) => (j === i ? { ...c, [v._id]: n } : c)))}
                />
              </div>
            );
          })}
        </fieldset>
      ))}
      <p className="flex items-center justify-between font-semibold">
        <span><Bilingual th="ราคารวม" en="Total" /></span>
        <Price amount={promotion.price} />
      </p>
      <Button disabled={!complete} onClick={add}>
        <Bilingual th="ใส่ตะกร้า" en="Add to cart" />
      </Button>
    </div>
  );
}
