"use client";

import {
  formatThaiAddress,
  type Purchase,
  UpdateOrderTrackingRequest,
} from "@merch/shared";
import { Button, Dialog, Input, Price } from "@merch/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useOrderCount } from "@/components/OrderCountProvider";
import { PaymentCheck } from "@/components/PaymentCheck";
import { ApiError, getOrder, updateOrderTracking } from "@/lib/api";
import {
  canSetTracking,
  formatBangkokDateTime,
  formatBuyerSummary,
  isPosSale,
  mapOrderError,
  orderTotal,
  shortOrderId,
} from "@/lib/orders";
import { COPY, formatOrderStatus, formatPaymentStatus } from "../copy";

// TODO(question 27): no endpoint to mark an order ARRIVED yet.

const BACK_LINK_CLASS =
  "inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-line bg-surface px-4 font-medium text-fg hover:bg-raised";

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-line bg-raised px-2.5 py-0.5 text-small font-semibold text-fg">
      {label}
    </span>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = typeof params.id === "string" ? params.id : "";
  const { refresh: refreshOrderCount } = useOrderCount();

  const [order, setOrder] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Copy states
  const [copiedField, setCopiedField] = useState<"phone" | "address" | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Tracking form states
  const [trackingDraft, setTrackingDraft] = useState("");
  const [trackingFieldError, setTrackingFieldError] = useState<string | undefined>(undefined);
  const [trackingApiError, setTrackingApiError] = useState<string | null>(null);
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);
  const [savingTracking, setSavingTracking] = useState(false);


  useEffect(() => {
    if (!orderId) return;
    let active = true;

    getOrder(orderId)
      .then((fetched) => {
        if (!active) return;
        setOrder(fetched);
        setPageError(null);
      })
      .catch((err) => {
        if (!active) return;
        const msg = mapOrderError(err);
        if (msg) setPageError(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId, reloadNonce]);

  const handleOrderUpdated = useCallback(
    async (statusNotice?: string) => {
      if (statusNotice) {
        setNotice(statusNotice);
      } else {
        setNotice(null);
      }
      setReloadNonce((n) => n + 1);
      await refreshOrderCount();
    },
    [refreshOrderCount],
  );

  async function handleCopyText(field: "phone" | "address", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 2000);
    } catch {
      // Ignore clipboard failures in restricted contexts.
    }
  }

  function handleOpenTrackingConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !canSetTracking(order) || savingTracking) return;

    setTrackingFieldError(undefined);
    setTrackingApiError(null);

    const parsed = UpdateOrderTrackingRequest.safeParse({ tracking_id: trackingDraft });
    if (!parsed.success) {
      setTrackingFieldError(COPY.trackingRequiredError);
      return;
    }

    setConfirmTrackingId(parsed.data.tracking_id);
  }

  async function handleConfirmSaveTracking() {
    if (!order || !confirmTrackingId || savingTracking) return;
    setSavingTracking(true);
    setTrackingApiError(null);

    try {
      await updateOrderTracking(order._id, { tracking_id: confirmTrackingId });
      setConfirmTrackingId(null);
      setTrackingDraft("");
      await handleOrderUpdated();
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_VERIFIED") {
        setTrackingApiError(COPY.notVerifiedError);
        setConfirmTrackingId(null);
        await handleOrderUpdated();
        return;
      }
      const msg = mapOrderError(err);
      if (msg) setTrackingApiError(msg);
    } finally {
      setSavingTracking(false);
    }
  }

  if (loading && !order) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/orders" className={BACK_LINK_CLASS}>
          {COPY.backToOrders}
        </Link>
        <p className="text-small text-fg-2">{COPY.loading}</p>
      </div>
    );
  }

  if (pageError || !order) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/orders" className={BACK_LINK_CLASS}>
          {COPY.backToOrders}
        </Link>
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger bg-surface p-4 text-small text-danger"
        >
          <span>{pageError ?? COPY.notFoundError}</span>
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
      </div>
    );
  }

  const pos = isPosSale(order);
  const shortId = shortOrderId(order._id);
  const formattedAddress = order.shipping_address
    ? formatThaiAddress(order.shipping_address)
    : null;
  const buyerFullName = formatBuyerSummary(order);
  const variantLines = order.products.flatMap((p) =>
    p.variants.map((v) => ({
      key: `${p.products_id}-${v.variants_id}`,
      product_name: p.product_name,
      variant_name: v.variant_name,
      count: v.count,
      unit_price: v.unit_price,
    })),
  );
  const totalAmount = orderTotal(order);
  const trackingAllowed = canSetTracking(order);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/orders" className={BACK_LINK_CLASS}>
          {COPY.backToOrders}
        </Link>
      </div>

      {/* Order Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 font-semibold text-fg">{COPY.orderHeading(shortId)}</h1>
          <p className="text-small text-fg-2">
            {formatBangkokDateTime(order.created_at)} · {COPY.channelLabel}:{" "}
            <strong className="font-semibold text-fg">
              {pos ? COPY.channelPos : COPY.channelOnline}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={`${COPY.statusFilterLabel}: ${formatOrderStatus(order.status)}`} />
          <StatusBadge
            label={`${COPY.paymentFilterLabel}: ${formatPaymentStatus(order.payment_status)}`}
          />
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-line bg-raised p-3 text-small text-fg"
        >
          {notice}
        </div>
      ) : null}

      {/* Screen-reader live region for copy announcements */}
      <span aria-live="polite" className="sr-only">
        {copiedField ? COPY.copiedButton : ""}
      </span>

      {/* Buyer & Shipping Address (Online orders only) */}
      {!pos && order.recipient ? (
        <section
          aria-labelledby="buyer-section-heading"
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
        >
          <h2 id="buyer-section-heading" className="text-h3 font-semibold text-fg">
            {COPY.buyerSectionTitle}
          </h2>

          <dl className="grid grid-cols-1 gap-3 text-small sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-fg-2">{COPY.buyerNameLabel}</dt>
              <dd className="font-semibold text-fg">
                {order.recipient.first_name} {order.recipient.last_name}
              </dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-fg-2">{COPY.buyerNicknameLabel}</dt>
              <dd className="font-semibold text-fg">{order.recipient.nickname}</dd>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-fg-2">{COPY.buyerPhoneLabel}</dt>
              <dd className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-fg">
                <span>{order.recipient.phone}</span>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={COPY.copyPhoneAria}
                  onClick={() => handleCopyText("phone", order.recipient!.phone)}
                >
                  {copiedField === "phone" ? COPY.copiedButton : COPY.copyButton}
                </Button>
              </dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-fg-2">{COPY.buyerLineIdLabel}</dt>
              <dd className="font-medium text-fg">
                {order.recipient.line_id ?? COPY.noValue}
              </dd>
            </div>

            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-fg-2">{COPY.buyerEmailLabel}</dt>
              <dd className="break-all font-medium text-fg">{order.recipient.email}</dd>
            </div>

            {formattedAddress ? (
              <div className="flex flex-col gap-1 border-t border-line pt-3 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-fg-2">{COPY.shippingAddressLabel}</dt>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={COPY.copyAddressAria}
                    onClick={() => handleCopyText("address", formattedAddress)}
                  >
                    {copiedField === "address" ? COPY.copiedButton : COPY.copyButton}
                  </Button>
                </div>
                <dd className="break-words text-body text-fg">{formattedAddress}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {/* Ordered Items & Money */}
      <section
        aria-labelledby="items-section-heading"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      >
        <h2 id="items-section-heading" className="text-h3 font-semibold text-fg">
          {COPY.itemsSectionTitle}
        </h2>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-small">
            <caption className="sr-only">{COPY.itemsTableCaption}</caption>
            <thead>
              <tr className="border-b border-line bg-raised text-fg">
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {COPY.colProduct}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {COPY.colVariant}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {COPY.colQuantity}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  {COPY.colUnitPrice}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {variantLines.map((line) => (
                <tr key={line.key} className="bg-surface">
                  <td className="px-4 py-2.5 font-medium text-fg">{line.product_name}</td>
                  <td className="px-4 py-2.5 text-fg">{line.variant_name}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-fg">{line.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-fg">
                    <Price amount={line.unit_price} />
                  </td>
                </tr>
              ))}
              {/* Promotion sets (D13): the set's price on its own row, then the pieces chosen. */}
              {order.promotions.map((set, i) => (
                <Fragment key={`set-${i}`}>
                  <tr className="bg-raised">
                    <td colSpan={3} className="px-4 py-2.5 font-semibold text-fg">
                      {set.promotion_name}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg">
                      <Price amount={set.price} />
                    </td>
                  </tr>
                  {set.variants.map((v) => (
                    <tr key={`set-${i}-${v.variants_id}`} className="bg-surface">
                      <td className="py-2.5 pr-4 pl-8 text-fg">{v.product_name}</td>
                      <td className="px-4 py-2.5 text-fg">{v.variant_name}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-fg">{v.count}</td>
                      <td />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="flex flex-col gap-2 border-t border-line pt-3 text-small">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-fg-2">{COPY.subtotalLabel}</dt>
            <dd className="font-semibold tabular-nums text-fg">
              <Price amount={order.original_price} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-fg-2">{COPY.shippingFeeLabel}</dt>
            <dd className="font-semibold tabular-nums text-fg">
              <Price amount={order.shipping_fee} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line pt-2 text-body">
            <dt className="font-semibold text-fg">{COPY.totalLabel}</dt>
            <dd className="font-semibold tabular-nums text-fg">
              <Price amount={totalAmount} />
            </dd>
          </div>
        </dl>
      </section>

      {/* Payment Verification (D10) */}
      <PaymentCheck
        order={order}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Tracking Section (Online orders only; never rendered for POS sales) */}
      {!pos ? (
        <section
          aria-labelledby="tracking-section-heading"
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
        >
          <h2 id="tracking-section-heading" className="text-h3 font-semibold text-fg">
            {COPY.trackingSectionTitle}
          </h2>

          {order.status === "SHIPPING" || order.status === "ARRIVED" ? (
            // TODO(edit tracking): tracking ID is read-only once status is SHIPPING.
            <div className="flex flex-col gap-1">
              <Input
                id="tracking-id-readonly"
                label={COPY.trackingInputLabel}
                value={order.tracking_id ?? COPY.noValue}
                readOnly
              />
            </div>
          ) : (
            <form onSubmit={handleOpenTrackingConfirm} noValidate className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Input
                    id="tracking-id-input"
                    label={COPY.trackingInputLabel}
                    placeholder={COPY.trackingPlaceholder}
                    value={trackingDraft}
                    disabled={!trackingAllowed || savingTracking}
                    error={trackingFieldError}
                    aria-describedby={
                      !trackingAllowed ? "tracking-disabled-reason" : undefined
                    }
                    onChange={(e) => {
                      setTrackingDraft(e.target.value);
                      if (trackingFieldError) setTrackingFieldError(undefined);
                      if (trackingApiError) setTrackingApiError(null);
                    }}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!trackingAllowed || savingTracking}
                >
                  {savingTracking ? COPY.saving : COPY.saveTrackingButton}
                </Button>
              </div>

              {!trackingAllowed ? (
                <p id="tracking-disabled-reason" className="text-small text-fg-2">
                  {order.payment_status === "REJECTED"
                    ? COPY.trackingRejectedHint
                    : COPY.trackingDisabledHint}
                </p>
              ) : null}

              {trackingApiError ? (
                <p role="alert" aria-live="polite" className="text-small text-danger">
                  {trackingApiError}
                </p>
              ) : null}
            </form>
          )}

          {/* Tracking Confirm Dialog */}
          <div className="[&_h2]:font-text [&_h2]:font-semibold">
            <Dialog
              open={confirmTrackingId !== null}
              onClose={() => {
                if (!savingTracking) setConfirmTrackingId(null);
              }}
              title={COPY.trackingConfirmTitle}
            >
              {confirmTrackingId ? (
                <div className="flex flex-col gap-4">
                  <p className="text-body text-fg">
                    {COPY.trackingConfirmBody(confirmTrackingId, buyerFullName)}
                  </p>

                  {trackingApiError ? (
                    <p role="alert" aria-live="polite" className="text-small text-danger">
                      {trackingApiError}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={savingTracking}
                      onClick={() => setConfirmTrackingId(null)}
                    >
                      {COPY.cancelButton}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={savingTracking}
                      onClick={handleConfirmSaveTracking}
                    >
                      {savingTracking ? COPY.saving : COPY.saveTrackingButton}
                    </Button>
                  </div>
                </div>
              ) : null}
            </Dialog>
          </div>
        </section>
      ) : null}
    </div>
  );
}
