import { Price } from "@merch/ui";

// Setup check (F2): display font, text font, colour tokens and one shared component.
// Replaced by the app's first real page.
export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="font-display text-h1 text-danger">TCOS merch</h1>
      <p className="mt-4 border-t border-line pt-4 text-body">
        POS app setup check. Total: <Price amount={270} />
      </p>
    </main>
  );
}
