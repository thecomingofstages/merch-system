"use client";

import type { Product, Shop, Variant } from "@merch/shared";
import { Button, Price } from "@merch/ui";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { listProducts, listShops } from "@/lib/api";
import { COPY } from "./copy";
import { ImagePreview, mapDashboardError } from "./helpers";
import {
  AddStockDialog,
  ArchiveConfirmDialog,
  type ArchiveTarget,
  CreateProductDialog,
  EditProductDialog,
  ShopFormDialog,
  VariantFormDialog,
} from "./ProductDialogs";

// TODO(un-archive): no un-archive endpoint in S2

function ArchivedBadge() {
  return (
    <span className="inline-flex items-center rounded-sm border border-rigging bg-rigging/40 px-2 py-0.5 text-small font-medium text-ink/80">
      {COPY.archivedBadge}
    </span>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const handleRedirect = useCallback(
    (path: string) => {
      router.replace(path);
    },
    [router],
  );

  const [showArchived, setShowArchived] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Dialog states
  const [shopModal, setShopModal] = useState<{ open: boolean; shop: Shop | null }>({
    open: false,
    shop: null,
  });
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [variantModal, setVariantModal] = useState<{
    open: boolean;
    productId: string;
    variant: Variant | null;
  }>({ open: false, productId: "", variant: null });
  const [stockModal, setStockModal] = useState<{
    open: boolean;
    productId: string;
    variant: Variant | null;
  }>({ open: false, productId: "", variant: null });
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      listShops({ includeArchived: showArchived }),
      listProducts({ includeArchived: showArchived }),
    ])
      .then(([fetchedShops, fetchedProducts]) => {
        if (!active) return;
        setShops(fetchedShops);
        setProducts(fetchedProducts);
        setPageError(null);
      })
      .catch((err) => {
        if (!active) return;
        const msg = mapDashboardError(err, handleRedirect);
        if (msg) setPageError(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [handleRedirect, showArchived, reloadNonce]);

  const refreshData = useCallback(async (createdShopId?: string) => {
    setReloadNonce((n) => n + 1);
    if (createdShopId) {
      setSelectedShopId(createdShopId);
    }
  }, []);

  // Derive active shop selection so we don't need synchronous setState inside useEffect.
  const activeShop =
    shops.find((s) => s._id === selectedShopId) ?? shops[0] ?? null;

  const shopProducts = activeShop
    ? products.filter((p) => p.shop_id === activeShop._id)
    : [];

  function toggleProductExpanded(productId: string) {
    setExpandedProductIds((prev) => ({
      ...prev,
      [productId]: !(prev[productId] ?? true),
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-semibold text-ink">{COPY.pageTitle}</h1>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-small font-medium text-ink">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setLoading(true);
                setShowArchived(e.target.checked);
              }}
              className="h-4 w-4 accent-ink"
            />
            <span>{COPY.showArchived}</span>
          </label>

          <Button
            type="button"
            variant="primary"
            onClick={() => setShopModal({ open: true, shop: null })}
          >
            {COPY.addShop}
          </Button>
        </div>
      </div>

      {/* Page-level Error */}
      {pageError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-curtain bg-house p-4 text-small text-curtain"
        >
          <span>{pageError}</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setReloadNonce((n) => n + 1);
            }}
          >
            {COPY.retry}
          </Button>
        </div>
      ) : null}

      {/* Shops Section */}
      <section aria-labelledby="shops-heading" className="flex flex-col gap-3">
        <h2 id="shops-heading" className="text-h3 font-semibold text-ink">
          {COPY.shopsHeading}
        </h2>

        {loading && shops.length === 0 ? (
          <p className="text-small text-ink/70">{COPY.loading}</p>
        ) : shops.length === 0 ? (
          <p className="rounded-lg border border-rigging bg-house p-4 text-small text-ink/70">
            {COPY.emptyShops}
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {shops.map((shop) => {
              const isSelected = activeShop?._id === shop._id;
              return (
                <div
                  key={shop._id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-violet bg-rigging/40"
                      : "border-rigging bg-house"
                  } ${shop.archived ? "opacity-75" : ""}`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedShopId(shop._id)}
                    className="flex min-h-11 items-center gap-2 rounded-sm px-2 py-1 text-left text-body font-semibold text-ink"
                  >
                    <span>{shop.shop_name}</span>
                    {shop.archived ? <ArchivedBadge /> : null}
                  </button>

                  {!shop.archived ? (
                    <div className="flex items-center gap-2 border-l border-rigging pl-2">
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label={`${COPY.rename} ${shop.shop_name}`}
                        onClick={() => setShopModal({ open: true, shop })}
                      >
                        {COPY.rename}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label={`${COPY.archive} ${shop.shop_name}`}
                        onClick={() => setArchiveTarget({ kind: "shop", shop })}
                      >
                        {COPY.archive}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Products Section for Selected Shop */}
      {activeShop ? (
        <section aria-labelledby="products-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 id="products-heading" className="text-h3 font-semibold text-ink">
                {COPY.productsHeading} — {activeShop.shop_name}
              </h2>
              {activeShop.archived ? <ArchivedBadge /> : null}
            </div>

            {!activeShop.archived ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setCreateProductOpen(true)}
              >
                {COPY.addProduct}
              </Button>
            ) : null}
          </div>

          {shopProducts.length === 0 ? (
            <p className="rounded-lg border border-rigging bg-house p-4 text-small text-ink/70">
              {COPY.emptyProducts}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-rigging bg-house">
              <table className="w-full border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-rigging bg-rigging/30 text-ink">
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {COPY.productNameLabel}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {COPY.variantsCountHeader}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {COPY.totalStockHeader}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {COPY.statusHeader}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      {COPY.actionsHeader}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rigging">
                  {shopProducts.map((product) => {
                    const visibleVariants = product.variants.filter(
                      (v) => showArchived || !v.archived,
                    );
                    const totalOnlineStock = visibleVariants.reduce(
                      (sum, v) => sum + v.online_stock,
                      0,
                    );
                    const isExpanded = expandedProductIds[product._id] ?? true;

                    return (
                      <Fragment key={product._id}>
                        <tr className={product.archived ? "bg-rigging/20 text-ink/70" : "bg-house"}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ImagePreview
                                url={product.image[0] ?? null}
                                alt={product.name}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 font-semibold text-ink">
                                  <span>{product.name}</span>
                                </div>
                                {product.description ? (
                                  <p className="text-small text-ink/70">{product.description}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {visibleVariants.length}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {totalOnlineStock}
                          </td>
                          <td className="px-4 py-3">
                            {product.archived ? (
                              <ArchivedBadge />
                            ) : (
                              <span className="text-small font-medium text-ink">
                                {COPY.activeStatus}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? COPY.collapseVariants : COPY.expandVariants}: ${product.name}`}
                                onClick={() => toggleProductExpanded(product._id)}
                              >
                                {isExpanded ? COPY.collapseVariants : COPY.expandVariants}
                              </Button>

                              {!product.archived ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    aria-label={`${COPY.addVariant}: ${product.name}`}
                                    onClick={() =>
                                      setVariantModal({
                                        open: true,
                                        productId: product._id,
                                        variant: null,
                                      })
                                    }
                                  >
                                    {COPY.addVariant}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    aria-label={`${COPY.edit} ${product.name}`}
                                    onClick={() => setEditingProduct(product)}
                                  >
                                    {COPY.edit}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    aria-label={`${COPY.archive} ${product.name}`}
                                    onClick={() =>
                                      setArchiveTarget({ kind: "product", product })
                                    }
                                  >
                                    {COPY.archive}
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>

                        {/* Nested Variants Sub-table */}
                        {isExpanded ? (
                          <tr className="bg-rigging/15">
                            <td colSpan={5} className="p-4">
                              <div className="overflow-x-auto rounded-lg border border-rigging bg-house">
                                {visibleVariants.length === 0 ? (
                                  <p className="p-3 text-small text-ink/70">
                                    {COPY.emptyVariants}
                                  </p>
                                ) : (
                                  <table className="w-full border-collapse text-left text-small">
                                    <thead>
                                      <tr className="border-b border-rigging bg-rigging/30 text-ink">
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                          {COPY.variantNameHeader}
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                          {COPY.variantPriceHeader}
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                          {COPY.variantImageHeader}
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                          {COPY.variantStockHeader}
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                          {COPY.variantBuyLimitHeader}
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                          {COPY.variantVisibleHeader}
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2 text-right font-semibold"
                                        >
                                          {COPY.actionsHeader}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-rigging">
                                      {visibleVariants.map((variant) => (
                                        <tr
                                          key={variant._id}
                                          className={
                                            variant.archived ? "text-ink/60" : "text-ink"
                                          }
                                        >
                                          <td className="px-3 py-2 font-medium">
                                            <div className="flex items-center gap-2">
                                              <span>{variant.name}</span>
                                              {variant.archived ? <ArchivedBadge /> : null}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <Price amount={variant.price} />
                                          </td>
                                          <td className="px-3 py-2">
                                            <ImagePreview
                                              url={variant.image}
                                              alt={variant.name}
                                              sizeClass="h-10 w-10"
                                            />
                                          </td>
                                          <td className="px-3 py-2 font-mono tabular-nums">
                                            {variant.online_stock}
                                          </td>
                                          <td className="px-3 py-2 font-mono tabular-nums">
                                            {variant.buy_limit === 0
                                              ? COPY.noLimit
                                              : variant.buy_limit}
                                          </td>
                                          <td className="px-3 py-2">
                                            {variant.visible_to_online
                                              ? COPY.visibleOnline
                                              : COPY.hiddenOnline}
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                              {!product.archived && !variant.archived ? (
                                                <>
                                                  <Button
                                                    type="button"
                                                    variant="secondary"
                                                    aria-label={`${COPY.addStockButton}: ${variant.name}`}
                                                    onClick={() =>
                                                      setStockModal({
                                                        open: true,
                                                        productId: product._id,
                                                        variant,
                                                      })
                                                    }
                                                  >
                                                    {COPY.addStockButton}
                                                  </Button>
                                                  {/* TODO(2.9): Transfer to POS action goes here */}
                                                  <Button
                                                    type="button"
                                                    variant="secondary"
                                                    aria-label={`${COPY.edit} ${variant.name}`}
                                                    onClick={() =>
                                                      setVariantModal({
                                                        open: true,
                                                        productId: product._id,
                                                        variant,
                                                      })
                                                    }
                                                  >
                                                    {COPY.edit}
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="secondary"
                                                    aria-label={`${COPY.archive} ${variant.name}`}
                                                    onClick={() =>
                                                      setArchiveTarget({
                                                        kind: "variant",
                                                        productId: product._id,
                                                        variant,
                                                      })
                                                    }
                                                  >
                                                    {COPY.archive}
                                                  </Button>
                                                </>
                                              ) : null}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : !loading && shops.length > 0 ? (
        <p className="text-small text-ink/70">{COPY.selectShopPrompt}</p>
      ) : null}

      {/* Dialogs */}
      <ShopFormDialog
        open={shopModal.open}
        shop={shopModal.shop}
        onClose={() => setShopModal({ open: false, shop: null })}
        onSuccess={refreshData}
        onRedirect={handleRedirect}
      />

      {activeShop ? (
        <CreateProductDialog
          open={createProductOpen}
          shopId={activeShop._id}
          onClose={() => setCreateProductOpen(false)}
          onSuccess={refreshData}
          onRedirect={handleRedirect}
        />
      ) : null}

      <EditProductDialog
        open={editingProduct !== null}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={refreshData}
        onRedirect={handleRedirect}
      />

      <VariantFormDialog
        open={variantModal.open}
        productId={variantModal.productId}
        variant={variantModal.variant}
        onClose={() => setVariantModal({ open: false, productId: "", variant: null })}
        onSuccess={refreshData}
        onRedirect={handleRedirect}
      />

      <AddStockDialog
        open={stockModal.open}
        productId={stockModal.productId}
        variant={stockModal.variant}
        onClose={() => setStockModal({ open: false, productId: "", variant: null })}
        onSuccess={refreshData}
        onRedirect={handleRedirect}
      />

      <ArchiveConfirmDialog
        target={archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onSuccess={refreshData}
        onRedirect={handleRedirect}
      />
    </div>
  );
}
