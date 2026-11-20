"use client";

import { Price } from "./Price";
import { setSoldOut, type SetVariant, type ShopPromotion } from "./PromotionPopup";

type PromotionCardProps<V extends SetVariant> = {
  promotion: ShopPromotion<V>;
  /** Client passes `online_stock`, POS passes `pos_stock`. */
  stockOf: (variant: V) => number;
  onOpen: (promotion: ShopPromotion<V>) => void;
};

/** Like ProductCard: the image, then the name and the set price; faded and "สินค้าหมด" when sold out. */
export function PromotionCard<V extends SetVariant>({ promotion, stockOf, onOpen }: PromotionCardProps<V>) {
  const soldOut = setSoldOut(promotion, stockOf);
  const fade = soldOut ? "opacity-40" : "";
  return (
    <button type="button" onClick={() => onOpen(promotion)} className="flex flex-col gap-1 text-left">
      {promotion.image ? (
        <img src={promotion.image} alt={promotion.name} className={`aspect-square w-full rounded-sm object-cover ${fade}`} />
      ) : (
        <div className={`aspect-square w-full rounded-sm bg-rigging ${fade}`} />
      )}
      <span className="font-medium">{promotion.name}</span>
      {soldOut ? <span>สินค้าหมด</span> : <Price amount={promotion.price} />}
    </button>
  );
}
