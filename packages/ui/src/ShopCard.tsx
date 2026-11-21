"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

type ShopCardProps = {
  name: string;
  image: string | null | undefined;
  /** Faded picture and no adding: nothing left to buy. */
  soldOut: boolean;
  /** The price line, or "สินค้าหมด". */
  price: ReactNode;
  /** How many are in the cart now; the badge shows from 1. */
  inCart: number;
  onDetails: () => void;
  /** "ใส่ตะกร้า"; left out where a card only shows (no adding from the card). */
  onBuy?: () => void;
};

/**
 * The body of a product or set card (docs/FRONTEND.md "Design direction": no card box). Each
 * button says which item it is for screen readers, as every card has the same two buttons.
 */
export function ShopCard({ name, image, soldOut, price, inCart, onDetails, onBuy }: ShopCardProps) {
  const fade = soldOut ? "opacity-40" : "";
  return (
    <div className="flex flex-col gap-1">
      {/* The picture also opens the details for a tap; the buttons below are the keyboard and screen-reader way in. */}
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onDetails} className="relative block">
        {image ? (
          <img src={image} alt="" className={`aspect-square w-full rounded-sm object-cover ${fade}`} />
        ) : (
          <div className={`aspect-square w-full rounded-sm bg-raised ${fade}`} />
        )}
        {inCart > 0 ? (
          <span className="absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gold px-2 text-small font-semibold tabular-nums text-canvas">
            {inCart}
          </span>
        ) : null}
      </button>
      <p className="mt-1 font-medium">
        {name}
        {inCart > 0 ? <span className="sr-only"> ในตะกร้า {inCart} ชิ้น</span> : null}
      </p>
      {price}
      <div className="mt-2 flex flex-col gap-1.5">
        <Button variant="secondary" size="sm" onClick={onDetails}>
          ดูรายละเอียด<span className="sr-only"> {name}</span>
        </Button>
        {onBuy ? (
          <Button size="sm" disabled={soldOut} onClick={onBuy}>
            ใส่ตะกร้า<span className="sr-only"> {name}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
