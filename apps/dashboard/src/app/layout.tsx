import type { Metadata } from "next";
import { Prompt, Sarabun } from "next/font/google";
import "./globals.css";

// docs/FRONTEND.md "Type": Prompt for headings, Sarabun for everything else, as on the other TCOS sites.
// On <html>: the tokens in styles.css read these variables on :root, so they must be set there.
const prompt = Prompt({ weight: ["500", "600"], subsets: ["thai", "latin"], variable: "--font-prompt" });
const sarabun = Sarabun({ weight: ["400", "500", "600"], subsets: ["thai", "latin"], variable: "--font-sarabun" });

export const metadata: Metadata = {
  title: "TCOS merch: Dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${prompt.variable} ${sarabun.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
