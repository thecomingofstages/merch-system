import type { Metadata } from "next";
import { CartProvider } from "@merch/ui";
import Link from "next/link";
import { Prompt, Sarabun } from "next/font/google";
import { ConsentBanner, ConsentSettingsButton } from "./ConsentBanner";
import { SiteHeader } from "./SiteHeader";
import "./globals.css";

// docs/FRONTEND.md "Type": Prompt for headings, Sarabun for everything else, as on the other TCOS sites.
// On <html>: the tokens in styles.css read these variables on :root, so they must be set there.
const prompt = Prompt({ weight: ["500", "600"], subsets: ["thai", "latin"], variable: "--font-prompt" });
const sarabun = Sarabun({ weight: ["400", "500", "600"], subsets: ["thai", "latin"], variable: "--font-sarabun" });

export const metadata: Metadata = {
  title: "TCOS Merch",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${prompt.variable} ${sarabun.variable}`}>
      <body className="antialiased">
        <CartProvider storageKey="merch-cart">
          <SiteHeader />
          {children}
          {/* pb-32: the shop's floating cart ticket must not cover the link at the bottom. */}
          <footer className="mx-auto flex max-w-5xl flex-wrap gap-x-6 px-4 pb-32 text-small sm:px-6">
            <Link href="/privacy" className="inline-flex min-h-11 items-center text-fg-2 underline underline-offset-2 hover:text-fg">
              นโยบายความเป็นส่วนตัว
            </Link>
            <ConsentSettingsButton />
          </footer>
          <ConsentBanner />
        </CartProvider>
      </body>
    </html>
  );
}
