"use client";

import type { CatalogProduct, CatalogVariant } from "@merch/shared";
import { Price } from "./Price";
import { ShopCard } from "./ShopCard";

/** The fields the product parts read, taken from the shared catalog types. Stock comes from `stockOf`, so client and POS variants both fit. */
export type ShopVariant = Pick<CatalogVariant, "_id" | "name" | "price" | "image" | "buy_limit">;
export type ShopProduct<V extends ShopVariant = ShopVariant> = Omit<CatalogProduct, "variants"> & { variants: V[] };

type ProductCardProps<V extends ShopVariant> = {
  product: ShopProduct<V>;
  /** Client passes `online_stock`, POS passes `pos_stock`. */
  stockOf: (variant: V) => number;
  /** "ดูรายละเอียด" (and the picture): opens the product. */
  onOpen: (product: ShopProduct<V>) => void;
  /** "ใส่ตะกร้า": the caller opens the product ready to add. Left out, the card has no such button. */
  onBuy?: (product: ShopProduct<V>) => void;
  /** How many of this product are in the cart now (the badge). */
  inCart?: number;
};

/** The image, then the name and price on the page background, and the two buttons. */
export function ProductCard<V extends ShopVariant>({ product, stockOf, onOpen, onBuy, inCart = 0 }: ProductCardProps<V>) {
  const inStock = product.variants.filter((v) => stockOf(v) > 0);
  // TODO(price on a card whose variants cost different amounts): shows the in-stock range "฿29–฿119" for now
  const prices = inStock.map((v) => v.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  return (
    <ShopCard
      name={product.name}
      image={product.image[0] ?? product.variants[0]?.image}
      soldOut={inStock.length === 0}
      inCart={inCart}
      onDetails={() => onOpen(product)}
      onBuy={onBuy && (() => onBuy(product))}
      price={
        inStock.length === 0 ? (
          <span className="text-fg-3">สินค้าหมด</span>
        ) : (
          <span className="text-fg-2 tabular-nums">
            <Price amount={low} />
            {high > low ? (
              <>
                –<Price amount={high} />
              </>
            ) : null}
          </span>
        )
      }
    />
  );
}
