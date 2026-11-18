"use client";

import type { Purchase, VerifyPaymentStatus } from "@merch/shared";
import { Button, Dialog, Price } from "@merch/ui";
import { useEffect, useRef, useState } from "react";
import { COPY, formatPaymentStatus } from "@/app/(admin)/orders/copy";
import { ApiError, updateOrderPayment } from "@/lib/api";
import {
  canCheckPayment,
  formatBangkokDateTime,
  isPosSale,
  mapOrderError,
  orderTotal,
} from "@/lib/orders";

// TODO(D10): if CEO rejects D10 (question 21), remove or simplify PaymentCheck in one place.
// TODO(parse transaction reference): format not specified; slip_qr_data is displayed raw.

export function PaymentCheck({
  order,
  onOrderUpdated,
  onRedirect,
}: {
  order: Purchase;
  onOrderUpdated: (notice?: string) => Promise<void>;
  onRedirect: (path: string) => void;
}) {
  const [confirmAction, setConfirmAction] = useState<VerifyPaymentStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSlip, setCopiedSlip] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const posSale = isPosSale(order);
  const expectedTotal = orderTotal(order);

  async function handleCopySlip() {
    if (!order.slip_qr_data) return;
    try {
      await navigator.clipboard.writeText(order.slip_qr_data);
      setCopiedSlip(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopiedSlip(false), 2000);
    } catch {
      // Ignore clipboard failures in restricted contexts.
    }
  }

  async function handleConfirmDecision() {
    if (!confirmAction || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateOrderPayment(order._id, { payment_status: confirmAction });
      setConfirmAction(null);
      await onOrderUpdated();
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_PENDING") {
        setConfirmAction(null);
        await onOrderUpdated(COPY.orderChangedNotice);
        return;
      }
      const msg = mapOrderError(err, onRedirect);
      if (msg) setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (posSale) {
    return (
      <section
        aria-labelledby="payment-section-heading"
        className="flex flex-col gap-3 rounded-lg border border-rigging bg-house p-4"
      >
        <h2 id="payment-section-heading" className="text-h3 font-semibold text-ink">
          {COPY.paymentSectionTitle}
        </h2>
        <p className="text-body text-ink">{COPY.posPaidOnSite}</p>
      </section>
    );
  }

  if (!order.slip_qr_data) {
    return (
      <section
        aria-labelledby="payment-section-heading"
        className="flex flex-col gap-3 rounded-lg border border-rigging bg-house p-4"
      >
        <h2 id="payment-section-heading" className="text-h3 font-semibold text-ink">
          {COPY.paymentSectionTitle}
        </h2>
        <p className="text-small text-ink/70">{COPY.noSlipData}</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="payment-section-heading"
      className="flex flex-col gap-4 rounded-lg border border-rigging bg-house p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="payment-section-heading" className="text-h3 font-semibold text-ink">
          {COPY.paymentSectionTitle}
        </h2>
        <span className="inline-flex items-center rounded-sm border border-rigging bg-rigging/40 px-2.5 py-0.5 text-small font-semibold text-ink">
          {formatPaymentStatus(order.payment_status)}
        </span>
      </div>

      <p className="text-small text-ink/80">{COPY.paymentCheckInstruction}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border border-rigging bg-rigging/15 p-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-small font-medium text-ink/80">
              {COPY.slipReferenceLabel}
            </span>
            <div className="flex items-center gap-2">
              <span aria-live="polite" className="sr-only">
                {copiedSlip ? COPY.copiedButton : ""}
              </span>
              <Button
                type="button"
                variant="secondary"
                aria-label={COPY.copySlipAria}
                onClick={handleCopySlip}
              >
                {copiedSlip ? COPY.copiedButton : COPY.copyButton}
              </Button>
            </div>
          </div>
          <code className="block break-all rounded-sm border border-rigging bg-house p-2 text-small text-ink">
            {order.slip_qr_data}
          </code>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-lg border border-rigging bg-rigging/15 p-3">
          <span className="text-small font-medium text-ink/80">{COPY.expectedTotalLabel}</span>
          <div className="text-h2 font-semibold tabular-nums text-ink">
            <Price amount={expectedTotal} />
          </div>
        </div>
      </div>

      {canCheckPayment(order) ? (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="primary"
            disabled={submitting}
            onClick={() => {
              setError(null);
              setConfirmAction("VERIFIED");
            }}
          >
            {COPY.verifyButton}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => {
              setError(null);
              setConfirmAction("REJECTED");
            }}
          >
            {COPY.rejectButton}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-small text-ink/80">
          <span>
            {COPY.paymentFilterLabel}:{" "}
            <strong className="font-semibold text-ink">
              {formatPaymentStatus(order.payment_status)}
            </strong>
          </span>
          {order.verified_at ? (
            <span>
              ({COPY.verifiedAtLabel}: {formatBangkokDateTime(order.verified_at)})
            </span>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" aria-live="polite" className="text-small text-curtain">
          {error}
        </p>
      ) : null}

      {/* Verify / Reject Confirm Dialog */}
      <div className="[&_h2]:font-text [&_h2]:font-semibold">
        <Dialog
          open={confirmAction !== null}
          onClose={() => {
            if (!submitting) setConfirmAction(null);
          }}
          title={
            confirmAction === "VERIFIED"
              ? COPY.verifyConfirmTitle
              : COPY.rejectConfirmTitle
          }
        >
          {confirmAction === "VERIFIED" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-lg border border-rigging bg-rigging/20 p-3 text-small">
                <div className="flex flex-col gap-1">
                  <span className="text-ink/70">{COPY.slipReferenceLabel}</span>
                  <code className="break-all font-semibold text-ink">
                    {order.slip_qr_data}
                  </code>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-rigging pt-2">
                  <span className="text-ink/70">{COPY.expectedTotalLabel}</span>
                  <span className="font-semibold tabular-nums text-ink">
                    <Price amount={expectedTotal} />
                  </span>
                </div>
              </div>

              <p className="text-body text-ink">{COPY.verifyConfirmQuestion}</p>

              {error ? (
                <p role="alert" aria-live="polite" className="text-small text-curtain">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => setConfirmAction(null)}
                >
                  {COPY.cancelButton}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={submitting}
                  onClick={handleConfirmDecision}
                >
                  {submitting ? COPY.saving : COPY.verifyButton}
                </Button>
              </div>
            </div>
          ) : confirmAction === "REJECTED" ? (
            <div className="flex flex-col gap-4">
              <p className="text-body text-ink">{COPY.rejectConfirmBody}</p>

              {error ? (
                <p role="alert" aria-live="polite" className="text-small text-curtain">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => setConfirmAction(null)}
                >
                  {COPY.cancelButton}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={handleConfirmDecision}
                >
                  {submitting ? COPY.saving : COPY.rejectButton}
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog>
      </div>
    </section>
  );
}
