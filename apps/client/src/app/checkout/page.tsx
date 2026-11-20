"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  CreateOrderRequest,
  formatThaiAddress,
  stockShortfalls,
  type CartLine,
  type MeResponse,
  type PostcodeLookupResponse,
  type QuoteResponse,
} from "@merch/shared";
import { Button, CartSummary, CartTicket, Dialog, Input, PaymentQR, readSlipQr, Select, useCart } from "@merch/ui";
import type { z } from "zod";
import { ApiError, clientApi } from "../../lib/api";
import { GoogleSignIn } from "./GoogleSignIn";

const detailsSchema = CreateOrderRequest.pick({ recipient: true, shipping_address: true });
type CheckedDetails = z.output<typeof detailsSchema>;

// docs/FRONTEND.md "Copy"
const OUT_OF_STOCK = "สินค้าบางรายการหมดแล้ว กรุณาแก้ไขตะกร้า";
const DUPLICATE_SLIP = "สลิปนี้ใช้กับคำสั่งซื้ออื่นแล้ว กรุณาอัปโหลดสลิปของคำสั่งซื้อนี้";
const QR_NOT_READ = "อ่าน QR จากสลิปไม่ได้ ลองอัปโหลดรูปที่ชัดขึ้น";
// TODO(Thai copy for stock running out during checkout)
const PAID_OUT_OF_STOCK =
  "Some items sold out before your order was saved. The shop will contact you on LINE to refund this payment.";
const cartUpdated = (names: string) => `Some items sold out, so your cart was updated: ${names}`;

// How often the checkout re-checks stock (the server has no push; see docs/FRONTEND.md "apps/client").
const STOCK_CHECK_MS = 15_000;

const EMPTY = {
  first_name: "", last_name: "", nickname: "", phone: "", line_id: "",
  postal_code: "", tambon: "", amphoe: "", province: "", details: "",
};
type Details = typeof EMPTY;
const EMPTY_PLACE = { tambon: "", amphoe: "", province: "" };

/** Autofill from GET /me: the details of the buyer's last order, all editable. */
function toDetails(me: MeResponse): Details {
  const saved = { ...EMPTY, ...me, ...me.address };
  return Object.fromEntries(Object.keys(EMPTY).map((key) => [key, saved[key as keyof Details] ?? ""])) as Details;
}

function errorText(cause: unknown): string {
  if (cause instanceof ApiError && cause.code === "OUT_OF_STOCK") return OUT_OF_STOCK;
  return cause instanceof Error ? cause.message : String(cause);
}

function focusStep(step: number) {
  requestAnimationFrame(() => document.getElementById(`step-${step}`)?.focus());
}

export default function Checkout() {
  const router = useRouter();
  const { lines, count, clear, setCount } = useCart();
  // `run` bumps on the way to payment, so the QR always shows a fresh quote.
  const [quoteRun, setQuoteRun] = useState(0);
  const [pricing, setPricing] = useState<{ cart: CartLine[]; run: number; quote?: QuoteResponse; error?: string } | null>(null);
  const [stockRun, setStockRun] = useState(0);
  const cart = useRef({ lines, setCount });
  // undefined while GET /me is loading, null when signed out.
  const [me, setMe] = useState<MeResponse | null>();
  const [values, setValues] = useState<Details>(EMPTY);
  const [places, setPlaces] = useState<{ code: string; list?: PostcodeLookupResponse; error?: string }>();
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [checked, setChecked] = useState<CheckedDetails>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // undefined until a file is picked, null when its QR can't be read (D5).
  const [slip, setSlip] = useState<string | null>();
  const [slipKey, setSlipKey] = useState(0);
  const [reading, setReading] = useState(false);
  const slipRun = useRef(0);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // A previous quote must disappear as soon as the cart changes.
  const currentPricing = pricing?.cart === lines && pricing.run === quoteRun ? pricing : null;
  const quote = currentPricing?.quote;
  const currentPlaces = places?.code === values.postal_code ? places : undefined;
  const placeList = currentPlaces?.list ?? [];
  const placeIndex = placeList.length === 1
    ? 0
    : placeList.findIndex((p) => p.tambon === values.tambon && p.amphoe === values.amphoe && p.province === values.province);
  const place = placeList[placeIndex];
  // TODO(Thai copy for a postcode with no tambon)
  const postcodeError = currentPlaces?.error ?? (currentPlaces?.list?.length === 0 ? "No tambon found for this postal code" : undefined);

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    clientApi.quote({
      channel: "ONLINE",
      items: lines.map(({ product_id, variant_id, count }) => ({ product_id, variant_id, count })),
    }).then(
      (quote) => { if (!cancelled) setPricing({ cart: lines, run: quoteRun, quote }); },
      (cause: unknown) => { if (!cancelled) setPricing({ cart: lines, run: quoteRun, error: errorText(cause) }); },
    );
    return () => { cancelled = true; };
  }, [lines, quoteRun]);

  useEffect(() => {
    cart.current = { lines, setCount };
  });

  // Re-checks stock while the buyer is in checkout, and takes what sold out out of the cart
  // (the quote, and so the QR, follow). Also right away after an order ran out of stock.
  const hasLines = lines.length > 0;
  useEffect(() => {
    if (!hasLines) return;
    let cancelled = false;
    const check = () => {
      if (document.hidden) return;
      clientApi.getCatalog().then((catalog) => {
        if (cancelled) return;
        const short = stockShortfalls(cart.current.lines, catalog);
        if (short.length === 0) return;
        for (const { line, available } of short) cart.current.setCount(line.variant_id, available);
        const names = short.map(({ line }) => `${line.product_name} (${line.variant_name})`).join(", ");
        setNotice((prev) => [prev, cartUpdated(names)].filter(Boolean).join(" "));
      }, () => {}); // a failed check waits for the next one
    };
    if (stockRun > 0) check();
    const timer = setInterval(check, STOCK_CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasLines, stockRun]);

  useEffect(() => {
    let cancelled = false;
    clientApi.getMe().then(
      (user) => {
        if (cancelled) return;
        setMe(user);
        setValues(toDetails(user));
      },
      (cause: unknown) => {
        if (cancelled) return;
        setMe(null);
        if (!(cause instanceof ApiError && cause.status === 401)) setNotice(errorText(cause));
      },
    );
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const code = values.postal_code;
    if (!/^\d{5}$/.test(code)) return;
    let cancelled = false;
    clientApi.getPostcode(code).then(
      (list) => { if (!cancelled) setPlaces({ code, list }); },
      (cause: unknown) => { if (!cancelled) setPlaces({ code, error: errorText(cause) }); },
    );
    return () => { cancelled = true; };
  }, [values.postal_code]);

  function signIn(idToken: string) {
    setNotice(null);
    clientApi.googleSignIn({ id_token: idToken }).then(
      (user) => {
        setMe(user);
        // After an expired session, keep what the buyer already typed.
        setValues((v) => (v === EMPTY ? toDetails(user) : v));
      },
      (cause: unknown) => setNotice(errorText(cause)),
    );
  }

  function go(next: 1 | 2 | 3) {
    setStep(next);
    focusStep(next);
  }

  const field = (name: keyof Details) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [name]: event.target.value })),
  });

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || !me) return;
    const parsed = detailsSchema.safeParse({
      recipient: { ...values, line_id: values.line_id || null, email: me.email },
      // Tambon, amphoe and province only ever come from the lookup of this postcode.
      shipping_address: { details: values.details, postal_code: values.postal_code, ...EMPTY_PLACE, ...place },
    });
    const fieldErrors: Partial<Record<keyof Details, string>> = parsed.success
      ? {}
      : Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.at(-1), issue.message]));
    if (postcodeError) fieldErrors.postal_code = postcodeError;
    setErrors(fieldErrors);
    const first = Object.keys(fieldErrors)[0];
    if (!parsed.success || first) {
      const input = first ? event.currentTarget.elements.namedItem(first) : null;
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    setChecked(parsed.data);
    setQuoteRun((run) => run + 1);
    go(2);
  }

  async function pickSlip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const run = ++slipRun.current;
    setSlip(undefined);
    setNotice(null);
    setReading(Boolean(file));
    if (!file) return;
    const data = await readSlipQr(file);
    if (run !== slipRun.current) return; // a newer file was picked meanwhile
    setReading(false);
    setSlip(data);
  }

  async function placeOrder() {
    if (!checked || !slip) return;
    setPlacing(true);
    setNotice(null);
    try {
      await clientApi.createOrder({
        items: lines.map(({ product_id, variant_id, count }) => ({ product_id, variant_id, count })),
        ...checked,
        slip_qr_data: slip,
      });
      clear();
      setPlaced(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "DUPLICATE_SLIP") {
        setSlip(undefined);
        setSlipKey((key) => key + 1); // empties the file input
        setNotice(DUPLICATE_SLIP);
        go(2);
      } else if (cause instanceof ApiError && cause.code === "OUT_OF_STOCK") {
        // Already paid: the server kept it as REFUND_DUE, and that slip is spent.
        setSlip(undefined);
        setSlipKey((key) => key + 1);
        setNotice(PAID_OUT_OF_STOCK);
        setStockRun((run) => run + 1);
        go(2);
      } else if (cause instanceof ApiError && cause.status === 401) {
        setMe(null);
        // TODO(Thai copy for an expired sign-in)
        setNotice("Please sign in again.");
        go(1);
      } else {
        setNotice(errorText(cause));
      }
    } finally {
      setPlacing(false);
    }
  }

  const back = (to: 1 | 2) => <Button variant="secondary" className="mt-6" onClick={() => go(to)}>Back</Button>;

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

      {notice ? <p role="alert" className="mb-6 text-curtain">{notice}</p> : null}

      {lines.length > 0 ? (
        <>
          {/* TODO(Thai copy for checkout steps, form labels, Back and Next): POC wording. */}
          <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
            <li aria-current={step === 1 ? "step" : undefined}>① Enter details</li>
            <li aria-current={step === 2 ? "step" : undefined}>② Payment</li>
            <li aria-current={step === 3 ? "step" : undefined}>③ Confirm order</li>
          </ol>

          <section hidden={step !== 1} aria-labelledby="step-1" aria-busy={me === undefined}>
            <h2 id="step-1" tabIndex={-1} className="mb-4 text-h3 font-semibold">① Enter details</h2>
            {me === null ? (
              <>
                {/* TODO(Thai copy for "sign in to continue") */}
                <p className="mb-4">Sign in with Google to continue.</p>
                <GoogleSignIn onToken={signIn} />
              </>
            ) : me ? (
              <form noValidate onSubmit={next}>
                <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Input {...field("first_name")} label="First name" autoComplete="given-name" required />
                  <Input {...field("last_name")} label="Last name" autoComplete="family-name" required />
                  <Input {...field("nickname")} label="Nickname" autoComplete="nickname" required />
                  <Input {...field("phone")} label="Phone" type="tel" autoComplete="tel" required />
                  <Input {...field("line_id")} label="LINE ID" />
                  <Input name="email" label="Email" type="email" value={me.email} readOnly />
                </fieldset>

                <fieldset className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                  <legend className="mb-4 text-h4 font-semibold">Shipping address</legend>
                  <Input {...field("postal_code")} error={errors.postal_code ?? postcodeError} label="Postal code" inputMode="numeric" maxLength={5} autoComplete="shipping postal-code" required />
                  <Select
                    name="tambon"
                    label="Tambon/Khwaeng"
                    required
                    disabled={placeList.length === 0}
                    value={placeIndex < 0 ? "" : String(placeIndex)}
                    error={errors.tambon}
                    onChange={(event) => {
                      const picked = placeList[Number(event.target.value)];
                      if (picked) setValues((v) => ({ ...v, ...picked }));
                    }}
                  >
                    <option value="" disabled>–</option>
                    {placeList.map((p, i) => <option key={i} value={i}>{p.tambon}</option>)}
                  </Select>
                  <Input name="amphoe" label="Amphoe/Khet" value={place?.amphoe ?? ""} readOnly />
                  <Input name="province" label="Province" value={place?.province ?? ""} readOnly />
                  <Input {...field("details")} label="Details" autoComplete="shipping street-address" required className="w-full" />
                </fieldset>

                {place && values.details.trim() ? (
                  <p aria-live="polite" className="mt-4">
                    {formatThaiAddress({ ...place, details: values.details.trim(), postal_code: values.postal_code })}
                  </p>
                ) : null}

                <Button type="submit" disabled={!quote} className="mt-6">Next</Button>
              </form>
            ) : null}
          </section>

          <section hidden={step !== 2} aria-labelledby="step-2">
            <h2 id="step-2" tabIndex={-1} className="mb-4 text-h3 font-semibold">② Payment</h2>
            {quote ? <PaymentQR promptpayId={quote.promptpay_id} amount={quote.total} /> : null}
            <div className="my-6">
              {/* TODO(Thai copy for "Upload slip" and "Slip read") */}
              <Input key={slipKey} type="file" accept="image/*" label="Upload slip" onChange={pickSlip} />
              <p aria-live="polite" className="mt-2">
                {reading ? "…" : slip === null ? QR_NOT_READ : slip ? "Slip read" : null}
              </p>
            </div>
            {quote ? (
              <CartTicket count={count} total={quote.total} action={
                <Button variant="secondary" disabled={!slip || reading} onClick={() => go(3)}>Next</Button>
              } />
            ) : null}
            {back(1)}
          </section>

          <section hidden={step !== 3} aria-labelledby="step-3">
            <h2 id="step-3" tabIndex={-1} className="mb-4 text-h3 font-semibold">③ Confirm order</h2>
            {checked ? (
              <div className="mb-6">
                <p>{checked.recipient.first_name} {checked.recipient.last_name} ({checked.recipient.nickname}) {checked.recipient.phone}</p>
                <p>{formatThaiAddress(checked.shipping_address)}</p>
              </div>
            ) : null}
            {quote ? (
              <CartTicket count={count} total={quote.total} action={
                <Button variant="secondary" disabled={!slip || placing} onClick={placeOrder}>สั่งซื้อ</Button>
              } />
            ) : null}
            {back(2)}
          </section>
        </>
      ) : null}

      <Dialog open={placed} onClose={() => router.push("/")} title="สั่งซื้อแล้ว">
        {/* TODO(Thai copy for the button that closes "Order placed") */}
        <Button onClick={() => router.push("/")}>Done</Button>
      </Dialog>
    </main>
  );
}
