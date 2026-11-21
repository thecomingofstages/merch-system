"use client";

import { Price } from "./Price";
import { ShopCard } from "./ShopCard";
import { setSoldOut, type SetVariant, type ShopPromotion } from "./PromotionPopup";

type PromotionCardProps<V extends SetVariant> = {
  promotion: ShopPromotion<V>;
  /** Client passes `online_stock`, POS passes `pos_stock`. */
  stockOf: (variant: V) => number;
  onOpen: (promotion: ShopPromotion<V>) => void;
  /** "ใส่ตะกร้า": a set always needs its pieces picked, so the caller opens it too. */
  onBuy?: (promotion: ShopPromotion<V>) => void;
  /** How many of this set are in the cart now (the badge). */
  inCart?: number;
};

/** Like ProductCard: the image, then the name and the set price; faded and "สินค้าหมด" when sold out. */
export function PromotionCard<V extends SetVariant>({ promotion, stockOf, onOpen, onBuy, inCart = 0 }: PromotionCardProps<V>) {
  const soldOut = setSoldOut(promotion, stockOf);
  return (
    <ShopCard
      name={promotion.name}
      image={promotion.image}
      soldOut={soldOut}
      inCart={inCart}
      onDetails={() => onOpen(promotion)}
      onBuy={onBuy && (() => onBuy(promotion))}
      price={soldOut ? <span className="text-fg-3">สินค้าหมด</span> : <span className="text-fg-2 tabular-nums"><Price amount={promotion.price} /></span>}
    />
  );
}
