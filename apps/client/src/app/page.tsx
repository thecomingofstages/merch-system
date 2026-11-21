"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogProduct, CatalogPromotion, CatalogResponse, CatalogVariant, CartLine } from "@merch/shared";
import { Button, CartTicket, maxCount, ProductCard, ProductPopup, PromotionCard, PromotionPopup, useCart } from "@merch/ui";
import { clientApi } from "../lib/api";

export default function Home() {
  const router = useRouter();
  const cart = useCart();
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
  const [activeSet, setActiveSet] = useState<CatalogPromotion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    clientApi.getCatalog().then(
      (response) => {
        if (!cancelled) setCatalog(response);
      },
      (cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // Single lines and set pieces share the stock (D13); buy_limit counts single lines only.
  const inSingles = (variantId: string) => cart.lines.find((line) => line.variant_id === variantId)?.count ?? 0;
  const inSets = (variantId: string) =>
    cart.sets.flatMap((s) => s.picks.flat()).reduce((sum, p) => sum + (p.variant_id === variantId ? p.count : 0), 0);

  function addToCart(variantId: string, count: number) {
    if (!activeProduct) return;
    const variant = activeProduct.variants.find((item) => item._id === variantId);
    if (!variant) return;

    const line: CartLine = {
      product_id: activeProduct._id,
      product_name: activeProduct.name,
      variant_id: variant._id,
      variant_name: variant.name,
      count,
      unit_price: variant.price,
    };

    cart.add(line, maxCount(variant.buy_limit, variant.online_stock - inSets(variant._id)));
    setActiveProduct(null);
  }

  return (
    <>
      <main aria-busy={catalog === null && error === null} className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6">
        {/* The header shows the logo; the page still needs its own h1 for screen readers. */}
        <h1 className="sr-only">TCOS Merch</h1>

        {error ? <p role="alert">{error}</p> : null}

        {catalog?.promotions.length ? (
          <section aria-labelledby="promotions" className="mb-10">
            {/* TODO(Thai copy for the promotions heading) */}
            <h2 id="promotions" className="mb-4 text-h3 text-fg">
              Promotions
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {catalog.promotions.map((promotion) => (
                <PromotionCard
                  key={promotion._id}
                  promotion={promotion}
                  stockOf={(variant) => variant.online_stock}
                  onOpen={() => setActiveSet(promotion)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {catalog?.shops.map((shop) => (
          <section key={shop._id} aria-labelledby={`shop-${shop._id}`} className="mb-10">
            <h2 id={`shop-${shop._id}`} className="mb-4 text-h3 text-fg">
              {shop.shop_name}
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {shop.products.map((product) => (
                <ProductCard<CatalogVariant>
                  key={product._id}
                  product={product}
                  stockOf={(variant) => variant.online_stock}
                  onOpen={() => setActiveProduct(product)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Only once something is in the cart: the ticket floats over the page, no tray behind it. */}
      {cart.count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6 motion-safe:animate-rise">
          <div className="mx-auto max-w-5xl shadow-xl shadow-sunk/60">
            <CartTicket
              count={cart.count}
              total={cart.subtotal}
              action={
                <Button variant="secondary" onClick={() => router.push("/checkout")}>
                  ชำระเงิน
                </Button>
              }
            />
          </div>
        </div>
      ) : null}

      <ProductPopup<CatalogVariant>
        product={activeProduct}
        stockOf={(variant) => variant.online_stock - inSets(variant._id)}
        inCart={inSingles}
        onAdd={addToCart}
        onClose={() => setActiveProduct(null)}
      />

      <PromotionPopup
        promotion={activeSet}
        stockOf={(variant) => variant.online_stock - inSingles(variant._id) - inSets(variant._id)}
        onAdd={(set) => {
          cart.addSet(set);
          setActiveSet(null);
        }}
        onClose={() => setActiveSet(null)}
      />
    </>
  );
}
