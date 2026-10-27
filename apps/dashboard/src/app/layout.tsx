import type { Metadata } from "next";
import { Anuphan, Chonburi } from "next/font/google";
import "./globals.css";

// docs/FRONTEND.md "Type": Chonburi for display, Anuphan for everything else.
const chonburi = Chonburi({ weight: "400", subsets: ["thai", "latin"], variable: "--font-chonburi" });
const anuphan = Anuphan({ weight: ["400", "500", "600"], subsets: ["thai", "latin"], variable: "--font-anuphan" });

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "TCOS merch: Dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${chonburi.variable} ${anuphan.variable} antialiased`}>{children}</body>
    </html>
  );
}
