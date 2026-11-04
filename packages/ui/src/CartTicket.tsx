"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Price } from "./Price";

type CartTicketProps = {
  /** Number of items in the cart. */
  count: number;
  total: number;
  /** The button on the stub, e.g. "ชำระเงิน". */
  action: ReactNode;
};

/** One notch cut into each side edge (docs/FRONTEND.md "The one bold element: the cart ticket"). A mask only reads alpha, so any opaque token works. */
const notches = {
  mask: [
    "radial-gradient(circle at left center, transparent 12px, var(--color-ink) 12.5px) left / 51% 100% no-repeat",
    "radial-gradient(circle at right center, transparent 12px, var(--color-ink) 12.5px) right / 51% 100% no-repeat",
  ].join(", "),
};

export function CartTicket({ count, total, action }: CartTicketProps) {
  // Bumped on each total change (not on first render) so the flash replays; motion-safe skips it under reduced motion.
  const [flash, setFlash] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else setFlash((n) => n + 1);
  }, [total]);

  return (
    <div style={notches} className="flex items-center gap-4 bg-curtain px-8 py-3 text-house">
      <span className="tabular-nums">{count} ชิ้น</span>
      <span
        key={flash}
        className={`ml-auto rounded-sm px-1 text-right font-display text-h3 tabular-nums ${flash ? "motion-safe:animate-flash" : ""}`}
      >
        <Price amount={total} />
      </span>
      {action}
    </div>
  );
}
