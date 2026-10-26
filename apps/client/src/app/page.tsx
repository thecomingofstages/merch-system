import { Price } from "@merch/ui";

// Setup check (F2): display font, text font, colour tokens and one shared component.
// Replaced by the app's first real page.
export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="font-display text-h1 text-curtain">TCOS merch</h1>
      <p className="mt-4 border-t border-rigging pt-4 text-body">
        Client app setup check. Total: <Price amount={270} />
      </p>
    </main>
  );
}
