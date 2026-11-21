"use client";

import { Button } from "@merch/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COPY as ORDERS_COPY } from "@/app/(admin)/orders/copy";
import { useOrderCount } from "@/components/OrderCountProvider";

// TODO(Thai copy for dashboard navigation): POC wording until the team picks the Thai
const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/promotions", label: "Promotions" },
  { href: "/analytics", label: "Analytics" },
  { href: "/orders", label: "Orders" },
  { href: "/pos", label: "POS" },
] as const;

const MENU_LABEL = "Menu";

/** The TCOS logo with "Merch", as on the shop. unoptimized: a small static file. */
function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-sm">
      <Image src="/logo.png" alt="The Coming of Stages" width={412} height={359} priority unoptimized className="h-9 w-auto" />
      <span className="font-display text-h4 font-medium text-fg">Merch</span>
    </Link>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { count: newOrderCount } = useOrderCount();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const mobileOpen = openOnPath === pathname;

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenOnPath(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <aside className="border-b border-line bg-sunk md:w-60 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <Brand />
        <Button
          variant="secondary"
          aria-expanded={mobileOpen}
          aria-controls="dashboard-nav"
          onClick={() => setOpenOnPath((prev) => (prev === pathname ? null : pathname))}
        >
          {MENU_LABEL}
        </Button>
      </div>

      <nav
        id="dashboard-nav"
        aria-label="Dashboard"
        className={`${mobileOpen ? "flex" : "hidden"} flex-col gap-2 border-t border-line p-4 md:sticky md:top-0 md:flex md:h-screen md:border-t-0`}
      >
        <div className="hidden px-2 pt-2 pb-4 md:block">
          <Brand />
        </div>
        <ul className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const showOrderBadge = item.href === "/orders" && newOrderCount > 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpenOnPath(null)}
                  className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 transition-colors duration-150 ${
                    active ? "bg-raised font-medium text-fg" : "text-fg-2 hover:bg-raised hover:text-fg"
                  }`}
                >
                  <span>{item.label}</span>
                  {showOrderBadge ? (
                    <span
                      aria-label={ORDERS_COPY.newOrdersBadgeLabel(newOrderCount)}
                      className="inline-flex min-w-6 items-center justify-center rounded-sm bg-gold px-1.5 py-0.5 text-small font-semibold tabular-nums text-canvas"
                    >
                      {newOrderCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

      </nav>
    </aside>
  );
}
