"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@merch/ui";

/** The basket from lucide (ISC): 24px box, 1.5 stroke, in the text color around it. */
function BasketIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 11-1 9" />
      <path d="m19 11-4-7" />
      <path d="M2 11h20" />
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
      <path d="M4.5 15.5h15" />
      <path d="m5 11 4-7" />
      <path d="m9 11 1 9" />
    </svg>
  );
}

/** The TCOS logo with "Merch", and the basket: it goes to checkout and shows the item count. */
export function SiteHeader() {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-sunk">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-sm">
          {/* unoptimized: a small static file, served as is on Workers */}
          <Image src="/logo.png" alt="The Coming of Stages" width={412} height={359} priority unoptimized className="h-10 w-auto" />
          <span className="font-display text-h4 font-medium text-fg">Merch</span>
        </Link>
        <Link
          href="/checkout"
          aria-label={`ตะกร้า ${count} ชิ้น`}
          className="relative inline-flex size-11 items-center justify-center rounded-lg text-fg-2 transition-colors duration-150 hover:bg-raised hover:text-fg"
        >
          <BasketIcon />
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-0.5 right-0.5 h-5 min-w-5 rounded-full bg-gold px-1 text-center text-small leading-5 font-semibold text-canvas tabular-nums"
            >
              {count}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
