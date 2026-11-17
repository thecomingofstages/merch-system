"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CreateOrderRequest, type CartLine, type QuoteResponse } from "@merch/shared";
import { Button, CartSummary, CartTicket, Input, useCart } from "@merch/ui";
import { ApiError, clientApi } from "../../lib/api";

const detailsSchema = CreateOrderRequest.pick({ recipient: true, shipping_address: true });

export default function Checkout() {
  const { lines, count } = useCart();
  const [pricing, setPricing] = useState<{
    cart: CartLine[];
    quote?: QuoteResponse;
    error?: string;
  } | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const paymentHeading = useRef<HTMLHeadingElement>(null);
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  // A previous quote must disappear as soon as the cart changes.
  const currentPricing = pricing?.cart === lines ? pricing : null;
  const quote = currentPricing?.quote;

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;

    clientApi.quote({
      channel: "ONLINE",
      items: lines.map(({ product_id, variant_id, count }) => ({ product_id, variant_id, count })),
    }).then(
      (quote) => {
        if (!cancelled) setPricing({ cart: lines, quote });
      },
      (cause: unknown) => {
        if (cancelled) return;
        const error = cause instanceof ApiError && cause.code === "OUT_OF_STOCK"
          ? "สินค้าบางรายการหมดแล้ว กรุณาแก้ไขตะกร้า"
          : cause instanceof Error ? cause.message : String(cause);
        setPricing({ cart: lines, error });
      },
    );

    return () => { cancelled = true; };
  }, [lines]);

  useEffect(() => {
    if (step === 2) paymentHeading.current?.focus();
  }, [step]);

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = detailsSchema.safeParse({
      recipient: { ...values, line_id: values.line_id || null },
      shipping_address: values,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.at(-1), issue.message])));
      const input = event.currentTarget.elements.namedItem(String(parsed.error.issues[0]?.path.at(-1)));
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    setErrors({});
    setStep(2);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-h2 font-semibold">ชำระเงิน</h1>
        <Link href="/" className="inline-flex min-h-11 items-center text-violet">Back</Link>
      </header>

      <section aria-label="Checkout" aria-busy={lines.length > 0 && !currentPricing} className="mb-8">
        <CartSummary lines={quote?.lines ?? lines} shippingFee={quote?.shipping_fee} total={quote?.total} />
        {currentPricing?.error ? <p role="alert" className="mt-4">{currentPricing.error}</p> : null}
      </section>

      {lines.length > 0 ? (
        <>
          {/* TODO(Thai copy for checkout steps, form labels, Back and Next): POC wording. */}
          <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
            <li aria-current={step === 1 ? "step" : undefined}>① Enter details</li>
            <li aria-current={step === 2 ? "step" : undefined}>② Payment</li>
            <li>③ Confirm order</li>
          </ol>

          <section hidden={step !== 1} aria-labelledby="details-heading">
            <h2 id="details-heading" ref={detailsHeading} tabIndex={-1} className="mb-4 text-h3 font-semibold">① Enter details</h2>
            <form noValidate onSubmit={next}>
              <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Input name="first_name" label="First name" autoComplete="given-name" required error={errors.first_name} />
                <Input name="last_name" label="Last name" autoComplete="family-name" required error={errors.last_name} />
                <Input name="nickname" label="Nickname" autoComplete="nickname" required error={errors.nickname} />
                <Input name="phone" label="Phone" type="tel" autoComplete="tel" required error={errors.phone} />
                <Input name="line_id" label="LINE ID" error={errors.line_id} />
                <Input name="email" label="Email" type="email" autoComplete="email" required error={errors.email} />
              </fieldset>

              <fieldset className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                <legend className="mb-4 text-h4 font-semibold">Shipping address</legend>
                <Input name="postal_code" label="Postal code" inputMode="numeric" autoComplete="shipping postal-code" required error={errors.postal_code} />
                <Input name="tambon" label="Tambon/Khwaeng" autoComplete="shipping address-level3" required error={errors.tambon} />
                <Input name="amphoe" label="Amphoe/Khet" autoComplete="shipping address-level2" required error={errors.amphoe} />
                <Input name="province" label="Province" autoComplete="shipping address-level1" required error={errors.province} />
                <Input name="details" label="Details" autoComplete="shipping street-address" required error={errors.details} className="w-full" />
              </fieldset>

              <Button type="submit" disabled={!quote} className="mt-6">Next</Button>
            </form>
          </section>

          <section hidden={step !== 2} aria-labelledby="payment-heading">
            <h2 id="payment-heading" ref={paymentHeading} tabIndex={-1} className="mb-4 text-h3 font-semibold">② Payment</h2>
            {/* TODO(task 1.5): PaymentQR, slip reading and order submission enable the remaining steps. */}
            {quote ? <CartTicket count={count} total={quote.total} action={<Button variant="secondary" disabled>Next</Button>} /> : null}
            <Button variant="secondary" className="mt-6" onClick={() => {
              setStep(1);
              requestAnimationFrame(() => detailsHeading.current?.focus());
            }}>Back</Button>
          </section>
        </>
      ) : null}
    </main>
  );
}
