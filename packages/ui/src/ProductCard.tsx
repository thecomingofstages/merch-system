"use client";

import type { CatalogProduct, CatalogVariant } from "@merch/shared";
import { Price } from "./Price";

/** The fields the product parts read, taken from the shared catalog types. Stock comes from `stockOf`, so client and POS variants both fit. */
export type ShopVariant = Pick<CatalogVariant, "_id" | "name" | "price" | "image" | "buy_limit">;
export type ShopProduct<V extends ShopVariant = ShopVariant> = Omit<CatalogProduct, "variants"> & { variants: V[] };

type ProductCardProps<V extends ShopVariant> = {
  product: ShopProduct<V>;
  /** Client passes `online_stock`, POS passes `pos_stock`. */
  stockOf: (variant: V) => number;
  onOpen: (product: ShopProduct<V>) => void;
};

/** No card box (docs/FRONTEND.md "Design direction"): the image, then the name and price on the page background. */
export function ProductCard<V extends ShopVariant>({ product, stockOf, onOpen }: ProductCardProps<V>) {
  const inStock = product.variants.filter((v) => stockOf(v) > 0);
  // TODO(price on a card whose variants cost different amounts): shows the in-stock range "฿29–฿119" for now
  const prices = inStock.map((v) => v.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const image = product.image[0] ?? product.variants[0]?.image;
  const fade = inStock.length ? "" : "opacity-40";

  return (
    <button type="button" onClick={() => onOpen(product)} className="flex flex-col gap-1 text-left">
      {image ? (
        <img src={image} alt={product.name} className={`aspect-square w-full rounded-sm object-cover ${fade}`} />
      ) : (
        <div className={`aspect-square w-full rounded-sm bg-rigging ${fade}`} />
      )}
      <span className="font-medium">{product.name}</span>
      {inStock.length === 0 ? (
        <span>สินค้าหมด</span>
      ) : (
        <span>
          <Price amount={low} />
          {high > low ? (
            <>
              –<Price amount={high} />
            </>
          ) : null}
        </span>
      )}
    </button>
  );
}
