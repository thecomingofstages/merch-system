"use client";

import {
  type Product,
  ProductPatch,
  ProductRequest,
  type Shop,
  ShopRequest,
  StockRequest,
  type Variant,
  VariantPatch,
  VariantRequest,
} from "@merch/shared";
import { Button, Dialog, Input } from "@merch/ui";
import { useState, type FormEvent } from "react";
import {
  addStock,
  archiveProduct,
  archiveShop,
  archiveVariant,
  createProduct,
  createShop,
  createVariant,
  updateProduct,
  updateShop,
  updateVariant,
} from "@/lib/api";
import { COPY } from "./copy";
import { ImagePreview, isValidHttpUrl, mapDashboardError, parseStrictInt } from "./helpers";

interface DialogCommonProps {
  onClose: () => void;
  onSuccess: (createdShopId?: string) => Promise<void>;
  onRedirect: (path: string) => void;
}

// 1. Shop Dialog (Create / Rename)

export function ShopFormDialog({
  open,
  shop,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & {
  open: boolean;
  shop: Shop | null;
}) {
  const title = shop ? COPY.editShopTitle : COPY.createShopTitle;
  return (
    <div className="[&_h2]:font-text [&_h2]:font-semibold">
      <Dialog open={open} onClose={onClose} title={title}>
        {open ? (
          <ShopFormBody
            key={shop ? shop._id : "new-shop"}
            shop={shop}
            onClose={onClose}
            onSuccess={onSuccess}
            onRedirect={onRedirect}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function ShopFormBody({
  shop,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & { shop: Shop | null }) {
  const [name, setName] = useState(shop?.shop_name ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldError(undefined);
    setApiError(null);

    const parsed = ShopRequest.safeParse({ shop_name: name });
    if (!parsed.success) {
      setFieldError(COPY.requiredField);
      return;
    }

    setSubmitting(true);
    try {
      if (shop) {
        await updateShop(shop._id, parsed.data);
        await onSuccess();
      } else {
        const created = await createShop(parsed.data);
        await onSuccess(created._id);
      }
      onClose();
    } catch (err) {
      const msg = mapDashboardError(err, onRedirect);
      if (msg) setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        id="shop-name-input"
        label={COPY.shopNameLabel}
        value={name}
        disabled={submitting}
        error={fieldError}
        onChange={(e) => {
          setName(e.target.value);
          if (fieldError) setFieldError(undefined);
          if (apiError) setApiError(null);
        }}
      />
      {apiError ? (
        <p role="alert" className="text-small text-curtain">
          {apiError}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
}

// 2. Create Product Dialog (with embedded variants)

interface VariantDraftRow {
  rowKey: number;
  name: string;
  price: string;
  image: string;
  buy_limit: string;
  visible_to_online: boolean;
}

interface VariantDraftRowErrors {
  name?: string;
  price?: string;
  image?: string;
  buy_limit?: string;
}

function createEmptyVariantDraft(rowKey: number): VariantDraftRow {
  return {
    rowKey,
    name: "",
    price: "0",
    image: "",
    buy_limit: "0",
    visible_to_online: true,
  };
}

export function CreateProductDialog({
  open,
  shopId,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & {
  open: boolean;
  shopId: string;
}) {
  return (
    <div className="[&_dialog]:max-w-2xl [&_h2]:font-text [&_h2]:font-semibold">
      <Dialog open={open} onClose={onClose} title={COPY.createProductTitle}>
        {open ? (
          <CreateProductFormBody
            key={`create-product-${shopId}`}
            shopId={shopId}
            onClose={onClose}
            onSuccess={onSuccess}
            onRedirect={onRedirect}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function CreateProductFormBody({
  shopId,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & { shopId: string }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageRows, setImageRows] = useState<Array<{ key: number; url: string }>>([
    { key: 1, url: "" },
  ]);
  const [nextImageKey, setNextImageKey] = useState(2);

  // Start with 2 variant rows so an admin creating a product with two variants can fill them right away.
  const [variantRows, setVariantRows] = useState<VariantDraftRow[]>([
    createEmptyVariantDraft(1),
    createEmptyVariantDraft(2),
  ]);
  const [nextVariantKey, setNextVariantKey] = useState(3);

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});
  const [variantErrors, setVariantErrors] = useState<Record<number, VariantDraftRowErrors>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleAddImageRow() {
    setImageRows((prev) => [...prev, { key: nextImageKey, url: "" }]);
    setNextImageKey((k) => k + 1);
  }

  function handleRemoveImageRow(rowKey: number) {
    setImageRows((prev) =>
      prev.length <= 1
        ? [{ key: nextImageKey, url: "" }]
        : prev.filter((r) => r.key !== rowKey),
    );
    if (imageRows.length <= 1) {
      setNextImageKey((k) => k + 1);
    }
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
  }

  function handleAddVariantRow() {
    setVariantRows((prev) => [...prev, createEmptyVariantDraft(nextVariantKey)]);
    setNextVariantKey((k) => k + 1);
  }

  function handleRemoveVariantRow(rowKey: number) {
    if (variantRows.length <= 1) return;
    setVariantRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
    setVariantErrors((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
  }

  function updateVariantField<K extends keyof VariantDraftRow>(
    rowKey: number,
    field: K,
    value: VariantDraftRow[K],
  ) {
    setVariantRows((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, [field]: value } : row)),
    );
    setVariantErrors((prev) => {
      if (!prev[rowKey]) return prev;
      const nextRow = { ...prev[rowKey] };
      delete nextRow[field as keyof VariantDraftRowErrors];
      return { ...prev, [rowKey]: nextRow };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setNameError(undefined);
    setImageErrors({});
    setVariantErrors({});
    setGeneralError(null);

    let hasClientError = false;

    if (!name.trim()) {
      setNameError(COPY.requiredField);
      hasClientError = true;
    }

    const nonEmptyImages: string[] = [];
    const nextImgErrors: Record<number, string> = {};
    for (const row of imageRows) {
      const trimmed = row.url.trim();
      if (!trimmed) continue;
      if (!isValidHttpUrl(trimmed)) {
        nextImgErrors[row.key] = COPY.invalidImageUrl;
        hasClientError = true;
      } else {
        nonEmptyImages.push(trimmed);
      }
    }
    setImageErrors(nextImgErrors);

    if (variantRows.length === 0) {
      setGeneralError(COPY.atLeastOneVariant);
      hasClientError = true;
    }

    const nextVarErrors: Record<number, VariantDraftRowErrors> = {};
    const parsedVariants: VariantRequest[] = [];

    for (const row of variantRows) {
      const rowErr: VariantDraftRowErrors = {};
      if (!row.name.trim()) {
        rowErr.name = COPY.requiredField;
      }
      const priceNum = parseStrictInt(row.price);
      if (priceNum === null || priceNum < 0) {
        rowErr.price = COPY.invalidNonNegativeInt;
      }
      const buyLimitNum = parseStrictInt(row.buy_limit);
      if (buyLimitNum === null || buyLimitNum < 0) {
        rowErr.buy_limit = COPY.invalidNonNegativeInt;
      }
      const trimmedVarImg = row.image.trim();
      if (trimmedVarImg && !isValidHttpUrl(trimmedVarImg)) {
        rowErr.image = COPY.invalidImageUrl;
      }

      if (Object.keys(rowErr).length > 0) {
        nextVarErrors[row.rowKey] = rowErr;
        hasClientError = true;
      } else if (priceNum !== null && buyLimitNum !== null) {
        const vParsed = VariantRequest.safeParse({
          name: row.name,
          price: priceNum,
          image: trimmedVarImg ? trimmedVarImg : null,
          buy_limit: buyLimitNum,
          visible_to_online: row.visible_to_online,
        });
        if (!vParsed.success) {
          nextVarErrors[row.rowKey] = { name: COPY.requiredField };
          hasClientError = true;
        } else {
          parsedVariants.push(vParsed.data);
        }
      }
    }
    setVariantErrors(nextVarErrors);

    if (hasClientError) return;

    const payloadResult = ProductRequest.safeParse({
      shop_id: shopId,
      name,
      description,
      image: nonEmptyImages,
      variants: parsedVariants,
    });

    if (!payloadResult.success) {
      setGeneralError(payloadResult.error.issues[0]?.message ?? COPY.requiredField);
      return;
    }

    setSubmitting(true);
    try {
      await createProduct(payloadResult.data);
      await onSuccess();
      onClose();
    } catch (err) {
      const msg = mapDashboardError(err, onRedirect);
      if (msg) setGeneralError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="-mx-2 flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-2 py-1"
    >
      <Input
        id="create-product-name"
        label={COPY.productNameLabel}
        value={name}
        disabled={submitting}
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(undefined);
        }}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="create-product-description" className="text-small font-medium text-ink">
          {COPY.productDescriptionLabel}
        </label>
        <textarea
          id="create-product-description"
          rows={2}
          value={description}
          disabled={submitting}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-rigging bg-house px-3 py-2 text-body text-ink focus:outline-3 focus:outline-offset-2 focus:outline-spotlight"
        />
      </div>

      {/* Product image URL rows */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-small font-medium text-ink">{COPY.productImagesLabel}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={handleAddImageRow}
          >
            {COPY.addImageRow}
          </Button>
        </div>
        {imageRows.map((row, idx) => (
          <div key={row.key} className="flex items-end gap-2">
            <div className=" pb-0.5">
              <ImagePreview
                url={row.url}
                alt={`${COPY.productImagesLabel} ${idx + 1}`}
                sizeClass="h-11 w-11"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                label={`${COPY.productImagesLabel} #${idx + 1}`}
                value={row.url}
                disabled={submitting}
                error={imageErrors[row.key]}
                placeholder="https://..."
                onChange={(e) => {
                  const val = e.target.value;
                  setImageRows((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, url: val } : r)),
                  );
                  if (imageErrors[row.key]) {
                    setImageErrors((prev) => {
                      const next = { ...prev };
                      delete next[row.key];
                      return next;
                    });
                  }
                }}
              />
            </div>
            {imageRows.length > 1 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => handleRemoveImageRow(row.key)}
              >
                {COPY.removeImageRow}
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Embedded variants rows */}
      <div className="flex flex-col gap-3 border-t border-rigging pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-small font-semibold text-ink">{COPY.variantsHeading}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={handleAddVariantRow}
          >
            {COPY.addVariantRow}
          </Button>
        </div>

        {variantRows.map((row, index) => {
          const errs = variantErrors[row.rowKey] ?? {};
          return (
            <div
              key={row.rowKey}
              className="flex flex-col gap-3 rounded-lg border border-rigging bg-house p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-small font-semibold text-ink">
                  {COPY.variantsHeading} #{index + 1}
                </span>
                {variantRows.length > 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => handleRemoveVariantRow(row.rowKey)}
                  >
                    {COPY.removeVariantRow}
                  </Button>
                ) : null}
              </div>

              <Input
                label={COPY.variantNameLabel}
                value={row.name}
                disabled={submitting}
                error={errs.name}
                onChange={(e) => updateVariantField(row.rowKey, "name", e.target.value)}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label={COPY.variantPriceLabel}
                  type="number"
                  min={0}
                  step={1}
                  value={row.price}
                  disabled={submitting}
                  error={errs.price}
                  onChange={(e) => updateVariantField(row.rowKey, "price", e.target.value)}
                />
                <Input
                  label={COPY.variantBuyLimitLabel}
                  type="number"
                  min={0}
                  step={1}
                  value={row.buy_limit}
                  disabled={submitting}
                  error={errs.buy_limit}
                  onChange={(e) => updateVariantField(row.rowKey, "buy_limit", e.target.value)}
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="pb-0.5">
                  <ImagePreview
                    url={row.image}
                    alt={`${COPY.variantImageLabel} ${index + 1}`}
                    sizeClass="h-11 w-11"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    label={COPY.variantImageLabel}
                    value={row.image}
                    disabled={submitting}
                    error={errs.image}
                    placeholder="https://..."
                    onChange={(e) => updateVariantField(row.rowKey, "image", e.target.value)}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-small text-ink">
                <input
                  type="checkbox"
                  checked={row.visible_to_online}
                  disabled={submitting}
                  onChange={(e) =>
                    updateVariantField(row.rowKey, "visible_to_online", e.target.checked)
                  }
                  className="h-4 w-4 accent-ink"
                />
                <span>{COPY.variantVisibleLabel}</span>
              </label>
            </div>
          );
        })}
      </div>

      {generalError ? (
        <p role="alert" className="text-small text-curtain">
          {generalError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-rigging pt-3">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
}

// 3. Edit Product Dialog (name, description, image URLs via ProductPatch)

export function EditProductDialog({
  open,
  product,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & {
  open: boolean;
  product: Product | null;
}) {
  return (
    <div className="[&_dialog]:max-w-2xl [&_h2]:font-text [&_h2]:font-semibold">
      <Dialog open={open} onClose={onClose} title={COPY.editProductTitle}>
        {open && product ? (
          <EditProductFormBody
            key={product._id}
            product={product}
            onClose={onClose}
            onSuccess={onSuccess}
            onRedirect={onRedirect}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function EditProductFormBody({
  product,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & { product: Product }) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [imageRows, setImageRows] = useState<Array<{ key: number; url: string }>>(() =>
    product.image.length > 0
      ? product.image.map((url, idx) => ({ key: idx + 1, url }))
      : [{ key: 1, url: "" }],
  );
  const [nextImageKey, setNextImageKey] = useState(product.image.length + 2);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleAddImageRow() {
    setImageRows((prev) => [...prev, { key: nextImageKey, url: "" }]);
    setNextImageKey((k) => k + 1);
  }

  function handleRemoveImageRow(rowKey: number) {
    setImageRows((prev) =>
      prev.length <= 1
        ? [{ key: nextImageKey, url: "" }]
        : prev.filter((r) => r.key !== rowKey),
    );
    if (imageRows.length <= 1) {
      setNextImageKey((k) => k + 1);
    }
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setNameError(undefined);
    setImageErrors({});
    setGeneralError(null);

    let hasClientError = false;
    if (!name.trim()) {
      setNameError(COPY.requiredField);
      hasClientError = true;
    }

    const nonEmptyImages: string[] = [];
    const nextImgErrors: Record<number, string> = {};
    for (const row of imageRows) {
      const trimmed = row.url.trim();
      if (!trimmed) continue;
      if (!isValidHttpUrl(trimmed)) {
        nextImgErrors[row.key] = COPY.invalidImageUrl;
        hasClientError = true;
      } else {
        nonEmptyImages.push(trimmed);
      }
    }
    setImageErrors(nextImgErrors);
    if (hasClientError) return;

    const parsed = ProductPatch.safeParse({
      name,
      description,
      image: nonEmptyImages,
    });
    if (!parsed.success) {
      setGeneralError(parsed.error.issues[0]?.message ?? COPY.requiredField);
      return;
    }

    setSubmitting(true);
    try {
      await updateProduct(product._id, parsed.data);
      await onSuccess();
      onClose();
    } catch (err) {
      const msg = mapDashboardError(err, onRedirect);
      if (msg) setGeneralError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="-mx-2 flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-2 py-1"
    >
      <Input
        id="edit-product-name"
        label={COPY.productNameLabel}
        value={name}
        disabled={submitting}
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(undefined);
        }}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="edit-product-description" className="text-small font-medium text-ink">
          {COPY.productDescriptionLabel}
        </label>
        <textarea
          id="edit-product-description"
          rows={2}
          value={description}
          disabled={submitting}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-rigging bg-house px-3 py-2 text-body text-ink focus:outline-3 focus:outline-offset-2 focus:outline-spotlight"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-small font-medium text-ink">{COPY.productImagesLabel}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={handleAddImageRow}
          >
            {COPY.addImageRow}
          </Button>
        </div>
        {imageRows.map((row, idx) => (
          <div key={row.key} className="flex items-end gap-2">
            <div className="pb-0.5">
              <ImagePreview
                url={row.url}
                alt={`${COPY.productImagesLabel} ${idx + 1}`}
                sizeClass="h-11 w-11"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                label={`${COPY.productImagesLabel} #${idx + 1}`}
                value={row.url}
                disabled={submitting}
                error={imageErrors[row.key]}
                placeholder="https://..."
                onChange={(e) => {
                  const val = e.target.value;
                  setImageRows((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, url: val } : r)),
                  );
                  if (imageErrors[row.key]) {
                    setImageErrors((prev) => {
                      const next = { ...prev };
                      delete next[row.key];
                      return next;
                    });
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => handleRemoveImageRow(row.key)}
            >
              {COPY.removeImageRow}
            </Button>
          </div>
        ))}
      </div>

      {generalError ? (
        <p role="alert" className="text-small text-curtain">
          {generalError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-rigging pt-3">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
}

// 4. Add / Edit Variant Dialog

export function VariantFormDialog({
  open,
  productId,
  variant,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & {
  open: boolean;
  productId: string;
  variant: Variant | null;
}) {
  const title = variant ? COPY.editVariantTitle : COPY.createVariantTitle;
  return (
    <div className="[&_dialog]:max-w-lg [&_h2]:font-text [&_h2]:font-semibold">
      <Dialog open={open} onClose={onClose} title={title}>
        {open ? (
          <VariantFormBody
            key={variant ? variant._id : `new-variant-${productId}`}
            productId={productId}
            variant={variant}
            onClose={onClose}
            onSuccess={onSuccess}
            onRedirect={onRedirect}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function VariantFormBody({
  productId,
  variant,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & { productId: string; variant: Variant | null }) {
  const [name, setName] = useState(variant?.name ?? "");
  const [price, setPrice] = useState(variant ? String(variant.price) : "0");
  const [image, setImage] = useState(variant?.image ?? "");
  const [buyLimit, setBuyLimit] = useState(variant ? String(variant.buy_limit) : "0");
  const [visibleToOnline, setVisibleToOnline] = useState(variant?.visible_to_online ?? true);

  const [errors, setErrors] = useState<VariantDraftRowErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setErrors({});
    setApiError(null);

    const nextErrs: VariantDraftRowErrors = {};
    if (!name.trim()) {
      nextErrs.name = COPY.requiredField;
    }
    const priceNum = parseStrictInt(price);
    if (priceNum === null || priceNum < 0) {
      nextErrs.price = COPY.invalidNonNegativeInt;
    }
    const buyLimitNum = parseStrictInt(buyLimit);
    if (buyLimitNum === null || buyLimitNum < 0) {
      nextErrs.buy_limit = COPY.invalidNonNegativeInt;
    }
    const trimmedImg = image.trim();
    if (trimmedImg && !isValidHttpUrl(trimmedImg)) {
      nextErrs.image = COPY.invalidImageUrl;
    }

    if (Object.keys(nextErrs).length > 0 || priceNum === null || buyLimitNum === null) {
      setErrors(nextErrs);
      return;
    }

    setSubmitting(true);
    try {
      if (variant) {
        const parsed = VariantPatch.safeParse({
          name,
          price: priceNum,
          image: trimmedImg ? trimmedImg : null,
          buy_limit: buyLimitNum,
          visible_to_online: visibleToOnline,
        });
        if (!parsed.success) {
          setApiError(parsed.error.issues[0]?.message ?? COPY.requiredField);
          setSubmitting(false);
          return;
        }
        await updateVariant(productId, variant._id, parsed.data);
      } else {
        const parsed = VariantRequest.safeParse({
          name,
          price: priceNum,
          image: trimmedImg ? trimmedImg : null,
          buy_limit: buyLimitNum,
          visible_to_online: visibleToOnline,
        });
        if (!parsed.success) {
          setApiError(parsed.error.issues[0]?.message ?? COPY.requiredField);
          setSubmitting(false);
          return;
        }
        await createVariant(productId, parsed.data);
      }
      await onSuccess();
      onClose();
    } catch (err) {
      const msg = mapDashboardError(err, onRedirect);
      if (msg) setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        id="variant-name-input"
        label={COPY.variantNameLabel}
        value={name}
        disabled={submitting}
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="variant-price-input"
          label={COPY.variantPriceLabel}
          type="number"
          min={0}
          step={1}
          value={price}
          disabled={submitting}
          error={errors.price}
          onChange={(e) => {
            setPrice(e.target.value);
            if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
          }}
        />
        <Input
          id="variant-buy-limit-input"
          label={COPY.variantBuyLimitLabel}
          type="number"
          min={0}
          step={1}
          value={buyLimit}
          disabled={submitting}
          error={errors.buy_limit}
          onChange={(e) => {
            setBuyLimit(e.target.value);
            if (errors.buy_limit) setErrors((prev) => ({ ...prev, buy_limit: undefined }));
          }}
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="pb-0.5">
          <ImagePreview url={image} alt={COPY.variantImageLabel} sizeClass="h-11 w-11" />
        </div>
        <div className="min-w-0 flex-1">
          <Input
            id="variant-image-input"
            label={COPY.variantImageLabel}
            value={image}
            disabled={submitting}
            error={errors.image}
            placeholder="https://..."
            onChange={(e) => {
              setImage(e.target.value);
              if (errors.image) setErrors((prev) => ({ ...prev, image: undefined }));
            }}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-small text-ink">
        <input
          type="checkbox"
          checked={visibleToOnline}
          disabled={submitting}
          onChange={(e) => setVisibleToOnline(e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        <span>{COPY.variantVisibleLabel}</span>
      </label>

      {apiError ? (
        <p role="alert" className="text-small text-curtain">
          {apiError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
}

// 5. Add Stock Dialog (validates with StockRequest from @merch/shared)

export function AddStockDialog({
  open,
  productId,
  variant,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & {
  open: boolean;
  productId: string;
  variant: Variant | null;
}) {
  return (
    <div className="[&_h2]:font-text [&_h2]:font-semibold">
      <Dialog open={open} onClose={onClose} title={COPY.addStockTitle}>
        {open && variant ? (
          <AddStockFormBody
            key={variant._id}
            productId={productId}
            variant={variant}
            onClose={onClose}
            onSuccess={onSuccess}
            onRedirect={onRedirect}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function AddStockFormBody({
  productId,
  variant,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & { productId: string; variant: Variant }) {
  const [amount, setAmount] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldError(undefined);
    setApiError(null);

    const amountInt = parseStrictInt(amount);
    if (amountInt === null) {
      setFieldError(COPY.invalidInteger);
      return;
    }

    const parsed = StockRequest.safeParse({ amount: amountInt });
    if (!parsed.success) {
      setFieldError(COPY.invalidNonZeroInt);
      return;
    }

    if (variant.online_stock + parsed.data.amount < 0) {
      setFieldError(COPY.stockBelowZeroError);
      return;
    }

    setSubmitting(true);
    try {
      await addStock(productId, variant._id, parsed.data);
      await onSuccess();
      onClose();
    } catch (err) {
      const msg = mapDashboardError(err, onRedirect);
      if (msg) setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-md border border-rigging bg-house p-3 text-small">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink/70">{COPY.variantNameLabel}</span>
          <span className="font-semibold text-ink">{variant.name}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink/70">{COPY.currentStockLabel}</span>
          <span className="font-mono font-semibold tabular-nums text-ink">
            {variant.online_stock}
          </span>
        </div>
      </div>

      <Input
        id="stock-amount-input"
        label={COPY.stockAmountLabel}
        type="number"
        step={1}
        value={amount}
        disabled={submitting}
        error={fieldError}
        onChange={(e) => {
          setAmount(e.target.value);
          if (fieldError) setFieldError(undefined);
          if (apiError) setApiError(null);
        }}
      />

      {apiError ? (
        <p role="alert" className="text-small text-curtain">
          {apiError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? COPY.saving : COPY.save}
        </Button>
      </div>
    </form>
  );
}

// 6. Archive Confirmation Dialog (Shop, Product, or Variant)

export type ArchiveTarget =
  | { kind: "shop"; shop: Shop }
  | { kind: "product"; product: Product }
  | { kind: "variant"; productId: string; variant: Variant };

export function ArchiveConfirmDialog({
  target,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & {
  target: ArchiveTarget | null;
}) {
  const open = target !== null;
  return (
    <div className="[&_h2]:font-text [&_h2]:font-semibold">
      <Dialog open={open} onClose={onClose} title={COPY.confirmArchiveTitle}>
        {target ? (
          <ArchiveConfirmBody
            key={
              target.kind === "shop"
                ? `shop-${target.shop._id}`
                : target.kind === "product"
                  ? `product-${target.product._id}`
                  : `variant-${target.variant._id}`
            }
            target={target}
            onClose={onClose}
            onSuccess={onSuccess}
            onRedirect={onRedirect}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function ArchiveConfirmBody({
  target,
  onClose,
  onSuccess,
  onRedirect,
}: DialogCommonProps & { target: ArchiveTarget }) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const itemName =
    target.kind === "shop"
      ? target.shop.shop_name
      : target.kind === "product"
        ? target.product.name
        : target.variant.name;

  async function handleConfirm() {
    if (submitting) return;
    setApiError(null);
    setSubmitting(true);
    try {
      if (target.kind === "shop") {
        await archiveShop(target.shop._id);
      } else if (target.kind === "product") {
        await archiveProduct(target.product._id);
      } else {
        await archiveVariant(target.productId, target.variant._id);
      }
      await onSuccess();
      onClose();
    } catch (err) {
      const msg = mapDashboardError(err, onRedirect);
      if (msg) setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body font-semibold text-ink">{itemName}</p>
      <p className="text-small text-ink/80">{COPY.confirmArchiveBody}</p>

      {apiError ? (
        <p role="alert" className="text-small text-curtain">
          {apiError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
          {COPY.cancel}
        </Button>
        <Button type="button" variant="primary" disabled={submitting} onClick={handleConfirm}>
          {submitting ? COPY.saving : COPY.archive}
        </Button>
      </div>
    </div>
  );
}
