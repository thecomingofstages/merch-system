"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Price } from "./Price";
import { QuantityStepper } from "./QuantityStepper";
import { Select } from "./Select";
import type { ShopProduct, ShopVariant } from "./ProductCard";

/** The most of one variant that can go into the cart: stock, and `buy_limit` when it is set (0 = no limit). */
export function maxCount(buyLimit: number, stock: number): number {
  const cap = buyLimit > 0 ? Math.min(buyLimit, stock) : stock;
  return Math.max(cap, 0);
}

type ProductPopupProps<V extends ShopVariant> = {
  /** The product to show; null closes the popup. */
  product: ShopProduct<V> | null;
  /** Client passes `online_stock`, POS passes `pos_stock`. */
  stockOf: (variant: V) => number;
  /** Quantity of this variant already in the cart, used to enforce the total buy limit. */
  inCart?: (variantId: string) => number;
  onAdd: (variantId: string, count: number) => void;
  onClose: () => void;
  /** Opened from a card's "ใส่ตะกร้า": the popup's own add button gets the focus. */
  focusAdd?: boolean;
};

export function ProductPopup<V extends ShopVariant>({ product, stockOf, inCart, onAdd, onClose, focusAdd = false }: ProductPopupProps<V>) {
  return (
    <Dialog open={product !== null} onClose={onClose} title={product?.name ?? ""} sheet>
      {/* key: a new product starts with its own first variant and an amount of 1 */}
      {product ? <PopupBody key={product._id} product={product} stockOf={stockOf} inCart={inCart} onAdd={onAdd} focusAdd={focusAdd} /> : null}
    </Dialog>
  );
}

function PopupBody<V extends ShopVariant>({
  product,
  stockOf,
  inCart,
  onAdd,
  focusAdd,
}: Pick<ProductPopupProps<V>, "stockOf" | "inCart" | "onAdd" | "focusAdd"> & { product: ShopProduct<V> }) {
  const firstInStock = product.variants.find((v) => stockOf(v) > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstInStock?._id ?? "");
  const [count, setCount] = useState(1);
  const variant = product.variants.find((v) => v._id === variantId);
  const max = variant
    ? remainingCount(maxCount(variant.buy_limit, stockOf(variant)), inCart?.(variant._id) ?? 0)
    : 0;
  const selectedCount = Math.min(count, max);
  const image = variant?.image ?? product.image[0];

  return (
    <div className="flex flex-col gap-4">
      {image ? <img src={image} alt={product.name} className="aspect-square w-full rounded-sm object-cover" /> : null}
      {product.description ? <p>{product.description}</p> : null}
      <Select
        label="ตัวเลือก"
        value={variantId}
        onChange={(e) => {
          setVariantId(e.target.value);
          setCount(1);
        }}
      >
        {product.variants.map((v) => {
          const soldOut = stockOf(v) <= 0;
          return (
            <option key={v._id} value={v._id} disabled={soldOut}>
              {v.name} · {soldOut ? "สินค้าหมด" : `฿${v.price.toLocaleString("th-TH")}`}
            </option>
          );
        })}
      </Select>
      {max > 0 && variant ? (
        <>
          <div className="flex items-center justify-between">
            <span className="font-medium">จำนวน</span>
            <QuantityStepper value={selectedCount} onChange={setCount} max={max} />
          </div>
          <p className="flex items-center justify-between">
            <span>ราคารวม</span>
            <Price amount={variant.price * selectedCount} />
          </p>
          <Button data-autofocus={focusAdd || undefined} onClick={() => onAdd(variant._id, selectedCount)}>ใส่ตะกร้า</Button>
        </>
      ) : (
        <p className="text-danger">
          {variant && stockOf(variant) > (inCart?.(variant._id) ?? 0)
            ? `จำกัด ${variant.buy_limit} ชิ้นต่อคำสั่งซื้อ ใส่ตะกร้าครบแล้ว`
            : "สินค้าหมด"}
        </p>
      )}
    </div>
  );
}

/** Remaining amount that may be added after enforcing stock, buy_limit, and cart contents. */
export function remainingCount(max: number, inCartCount: number): number {
  return Math.max(max - Math.max(inCartCount, 0), 0);
}
