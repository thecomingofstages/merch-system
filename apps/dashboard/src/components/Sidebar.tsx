"use client";

import { Button } from "@merch/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAdminToken } from "@/lib/api";

// TODO(Thai copy for dashboard navigation and sign-out): POC wording until the team picks the Thai
const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
  // TODO(2.8): show new-order badge on Orders
  { href: "/orders", label: "Orders" },
  { href: "/pos", label: "POS" },
] as const;

const SIGN_OUT_LABEL = "Sign out";
const MENU_LABEL = "Menu";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
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

  function handleSignOut() {
    clearAdminToken();
    router.replace("/sign-in");
  }

  return (
    <aside className="border-b border-rigging bg-house md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <span className="font-semibold">TCOS</span>
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
        className={`${mobileOpen ? "flex" : "hidden"} flex-col justify-between gap-6 border-t border-rigging p-4 md:flex md:min-h-screen md:border-t-0`}
      >
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpenOnPath(null)}
                  className={`flex min-h-11 items-center rounded-lg px-3 text-ink ${
                    active ? "border border-rigging bg-rigging/40 font-semibold" : "hover:bg-rigging/40"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <Button variant="secondary" onClick={handleSignOut} className="w-full justify-start">
          {SIGN_OUT_LABEL}
        </Button>
      </nav>
    </aside>
  );
}
