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
  onAdd: (variantId: string, count: number) => void;
  onClose: () => void;
};

export function ProductPopup<V extends ShopVariant>({ product, stockOf, onAdd, onClose }: ProductPopupProps<V>) {
  return (
    <Dialog open={product !== null} onClose={onClose} title={product?.name ?? ""} sheet>
      {/* key: a new product starts with its own first variant and an amount of 1 */}
      {product ? <PopupBody key={product._id} product={product} stockOf={stockOf} onAdd={onAdd} /> : null}
    </Dialog>
  );
}

function PopupBody<V extends ShopVariant>({
  product,
  stockOf,
  onAdd,
}: Pick<ProductPopupProps<V>, "stockOf" | "onAdd"> & { product: ShopProduct<V> }) {
  const firstInStock = product.variants.find((v) => stockOf(v) > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstInStock?._id ?? "");
  const [count, setCount] = useState(1);
  const variant = product.variants.find((v) => v._id === variantId);
  const max = variant ? maxCount(variant.buy_limit, stockOf(variant)) : 0;
  const image = variant?.image ?? product.image[0];

  return (
    <div className="flex flex-col gap-4">
      {image ? <img src={image} alt={product.name} className="aspect-square w-full rounded-sm object-cover" /> : null}
      {product.description ? <p>{product.description}</p> : null}
      {/* TODO(Thai copy for "Variant", "Amount" and "Total price"): POC wording until the team picks the Thai */}
      <Select
        label="Variant"
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
            <span className="font-medium">Amount</span>
            <QuantityStepper value={count} onChange={setCount} max={max} />
          </div>
          <p className="flex items-center justify-between">
            <span>Total price</span>
            <Price amount={variant.price * count} />
          </p>
          <Button onClick={() => onAdd(variant._id, Math.min(count, max))}>ใส่ตะกร้า</Button>
        </>
      ) : (
        <p className="text-curtain">สินค้าหมด</p>
      )}
    </div>
  );
}
