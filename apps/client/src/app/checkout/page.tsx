"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  CreateOrderRequest,
  formatThaiAddress,
  setRequest,
  stockShortfalls,
  unavailableSets,
  type CartLine,
  type CartSet,
  type MeResponse,
  type PostcodeLookupResponse,
  type QuoteResponse,
} from "@merch/shared";
import { Bilingual, Button, CartSummary, CartTicket, Dialog, Input, PaymentQR, readSlipQr, Select, useCart } from "@merch/ui";
import type { z } from "zod";
import { ApiError, clientApi } from "../../lib/api";
import { GoogleSignIn } from "./GoogleSignIn";

const detailsSchema = CreateOrderRequest.pick({ recipient: true, shipping_address: true });
type CheckedDetails = z.output<typeof detailsSchema>;

// docs/FRONTEND.md "Copy"
const OUT_OF_STOCK = <Bilingual stack th="สินค้าบางรายการหมดแล้ว กรุณาแก้ไขตะกร้า" en="Some items have sold out. Please update your cart." />;
const DUPLICATE_SLIP = (
  <Bilingual
    stack
    th="สลิปนี้ใช้กับคำสั่งซื้ออื่นแล้ว กรุณาอัปโหลดสลิปของคำสั่งซื้อนี้"
    en="This slip was already used for another order. Please upload the slip for this order."
  />
);
const QR_NOT_READ = (
  <Bilingual stack th="อ่าน QR จากสลิปไม่ได้ ลองอัปโหลดรูปที่ชัดขึ้น" en="We couldn't read the QR on this slip. Try a sharper photo." />
);
const PAID_OUT_OF_STOCK = (
  <Bilingual
    stack
    th="สินค้าบางรายการหมดก่อนบันทึกคำสั่งซื้อ ร้านจะติดต่อทาง LINE เพื่อคืนเงินที่โอนมา"
    en="Some items sold out before we could save your order. The shop will contact you on LINE to refund your payment."
  />
);
const SIGNED_OUT = <Bilingual stack th="หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง" en="You were signed out. Please sign in again." />;
const NO_TAMBON = <Bilingual th="ไม่พบตำบลของรหัสไปรษณีย์นี้" en="No subdistrict found for this postal code" />;
const cartUpdated = (names: string) => (
  <Bilingual stack th={`สินค้าบางรายการหมด เราปรับตะกร้าให้แล้ว: ${names}`} en={`Some items sold out, so we updated your cart: ${names}`} />
);

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

function errorText(cause: unknown): ReactNode {
  if (cause instanceof ApiError && cause.code === "OUT_OF_STOCK") return OUT_OF_STOCK;
  return cause instanceof Error ? cause.message : String(cause);
}

/** The cart as POST /quote and POST /orders take it: no prices, the server sets them. */
const cartRequest = (lines: CartLine[], sets: CartSet[]) => ({
  items: lines.map(({ product_id, variant_id, count }) => ({ product_id, variant_id, count })),
  promotions: sets.map(setRequest),
});

function focusStep(step: number) {
  requestAnimationFrame(() => document.getElementById(`step-${step}`)?.focus());
}

export default function Checkout() {
  const router = useRouter();
  const { lines, sets, count, clear, setCount, removeSet } = useCart();
  // `run` bumps on the way to payment, so the QR always shows a fresh quote.
  const [quoteRun, setQuoteRun] = useState(0);
  const [pricing, setPricing] = useState<{
    cart: CartLine[];
    sets: CartSet[];
    run: number;
    quote?: QuoteResponse;
    error?: ReactNode;
  } | null>(null);
  const [stockRun, setStockRun] = useState(0);
  const cart = useRef({ lines, sets, setCount, removeSet });
  const hasItems = lines.length + sets.length > 0;
  // undefined while GET /me is loading, null when signed out.
  const [me, setMe] = useState<MeResponse | null>();
  const [values, setValues] = useState<Details>(EMPTY);
  const [places, setPlaces] = useState<{ code: string; list?: PostcodeLookupResponse; error?: ReactNode }>();
  const [errors, setErrors] = useState<Partial<Record<keyof Details, ReactNode>>>({});
  const [checked, setChecked] = useState<CheckedDetails>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // undefined until a file is picked, null when its QR can't be read (D5).
  const [slip, setSlip] = useState<string | null>();
  const [slipKey, setSlipKey] = useState(0);
  const [reading, setReading] = useState(false);
  const slipRun = useRef(0);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [notice, setNotice] = useState<ReactNode>(null);

  // A previous quote must disappear as soon as the cart changes.
  const currentPricing = pricing?.cart === lines && pricing.sets === sets && pricing.run === quoteRun ? pricing : null;
  const quote = currentPricing?.quote;
  const currentPlaces = places?.code === values.postal_code ? places : undefined;
  const placeList = currentPlaces?.list ?? [];
  const placeIndex = placeList.length === 1
    ? 0
    : placeList.findIndex((p) => p.tambon === values.tambon && p.amphoe === values.amphoe && p.province === values.province);
  const place = placeList[placeIndex];
  const postcodeError = currentPlaces?.error ?? (currentPlaces?.list?.length === 0 ? NO_TAMBON : undefined);

  useEffect(() => {
    if (lines.length + sets.length === 0) return;
    let cancelled = false;
    clientApi.quote({ channel: "ONLINE", ...cartRequest(lines, sets) }).then(
      (quote) => { if (!cancelled) setPricing({ cart: lines, sets, run: quoteRun, quote }); },
      (cause: unknown) => { if (!cancelled) setPricing({ cart: lines, sets, run: quoteRun, error: errorText(cause) }); },
    );
    return () => { cancelled = true; };
  }, [lines, sets, quoteRun]);

  useEffect(() => {
    cart.current = { lines, sets, setCount, removeSet };
  });

  // Re-checks stock while the buyer is in checkout, and takes what sold out out of the cart
  // (the quote, and so the QR, follow). Also right away after an order ran out of stock.
  useEffect(() => {
    if (!hasItems) return;
    let cancelled = false;
    const check = () => {
      if (document.hidden) return;
      clientApi.getCatalog().then((catalog) => {
        if (cancelled) return;
        const short = stockShortfalls(cart.current.lines, catalog);
        const goneSets = unavailableSets(cart.current.sets, catalog);
        if (short.length + goneSets.length === 0) return;
        for (const { line, available } of short) cart.current.setCount(line.variant_id, available);
        for (const set of goneSets) cart.current.removeSet(set.key);
        const names = [
          ...short.map(({ line }) => `${line.product_name} (${line.variant_name})`),
          ...goneSets.map((set) => set.name),
        ].join(", ");
        setNotice((prev) => (prev ? <>{prev}<br />{cartUpdated(names)}</> : cartUpdated(names)));
      }, () => {}); // a failed check waits for the next one
    };
    if (stockRun > 0) check();
    const timer = setInterval(check, STOCK_CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hasItems, stockRun]);

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
    const fieldErrors: Partial<Record<keyof Details, ReactNode>> = parsed.success
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
        ...cartRequest(lines, sets),
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
        setNotice(SIGNED_OUT);
        go(1);
      } else {
        setNotice(errorText(cause));
      }
    } finally {
      setPlacing(false);
    }
  }

  const back = (to: 1 | 2) => <Button variant="secondary" className="mt-6" onClick={() => go(to)}><Bilingual th="กลับ" en="Back" /></Button>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-h2"><Bilingual th="ชำระเงิน" en="Checkout" /></h1>
        <Link href="/" className="inline-flex min-h-11 items-center text-gold"><Bilingual th="กลับ" en="Back" /></Link>
      </header>

      <section aria-label="สรุปคำสั่งซื้อ" aria-busy={hasItems && !currentPricing} className="mb-8 rounded-xl border border-line bg-surface p-5">
        <CartSummary lines={quote?.lines ?? lines} sets={quote?.promotions ?? sets} shippingFee={quote?.shipping_fee} total={quote?.total} />
        {currentPricing?.error ? <p role="alert" className="mt-4">{currentPricing.error}</p> : null}
      </section>

      {notice ? <p role="alert" className="mb-6 text-danger">{notice}</p> : null}

      {hasItems ? (
        <>
          <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-fg-3 [&>[aria-current=step]]:font-medium [&>[aria-current=step]]:text-fg">
            <li aria-current={step === 1 ? "step" : undefined}>① <Bilingual th="กรอกข้อมูล" en="Your details" /></li>
            <li aria-current={step === 2 ? "step" : undefined}>② <Bilingual th="ชำระเงิน" en="Payment" /></li>
            <li aria-current={step === 3 ? "step" : undefined}>③ <Bilingual th="ยืนยันคำสั่งซื้อ" en="Confirm order" /></li>
          </ol>

          <section hidden={step !== 1} aria-labelledby="step-1" aria-busy={me === undefined}>
            <h2 id="step-1" tabIndex={-1} className="mb-4 text-h3">① <Bilingual th="กรอกข้อมูล" en="Your details" /></h2>
            {me === null ? (
              <>
                <p className="mb-4"><Bilingual th="เข้าสู่ระบบด้วย Google ก่อนกรอกข้อมูล" en="Sign in with Google to fill in your details" /></p>
                <GoogleSignIn onToken={signIn} />
              </>
            ) : me ? (
              <form noValidate onSubmit={next}>
                <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Input {...field("first_name")} label={<Bilingual th="ชื่อ" en="First name" />} autoComplete="given-name" required />
                  <Input {...field("last_name")} label={<Bilingual th="นามสกุล" en="Last name" />} autoComplete="family-name" required />
                  <Input {...field("nickname")} label={<Bilingual th="ชื่อเล่น" en="Nickname" />} autoComplete="nickname" required />
                  <Input {...field("phone")} label={<Bilingual th="เบอร์โทร" en="Phone" />} type="tel" autoComplete="tel" required />
                  <Input {...field("line_id")} label="LINE ID" />
                  <Input name="email" label={<Bilingual th="อีเมล" en="Email" />} type="email" value={me.email} readOnly />
                </fieldset>

                <fieldset className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                  <legend className="mb-4 text-h4 font-semibold"><Bilingual th="ที่อยู่จัดส่ง" en="Shipping address" /></legend>
                  <Input {...field("postal_code")} error={errors.postal_code ?? postcodeError} label={<Bilingual th="รหัสไปรษณีย์" en="Postal code" />} inputMode="numeric" maxLength={5} autoComplete="shipping postal-code" required />
                  <Select
                    name="tambon"
                    label={<Bilingual th="ตำบล/แขวง" en="Subdistrict" />}
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
                  <Input name="amphoe" label={<Bilingual th="อำเภอ/เขต" en="District" />} value={place?.amphoe ?? ""} readOnly />
                  <Input name="province" label={<Bilingual th="จังหวัด" en="Province" />} value={place?.province ?? ""} readOnly />
                  <Input {...field("details")} label={<Bilingual th="บ้านเลขที่ ซอย ถนน" en="House no., soi, road" />} autoComplete="shipping street-address" required className="w-full" />
                </fieldset>

                {place && values.details.trim() ? (
                  <p aria-live="polite" className="mt-4">
                    {formatThaiAddress({ ...place, details: values.details.trim(), postal_code: values.postal_code })}
                  </p>
                ) : null}

                <Button type="submit" disabled={!quote} className="mt-6"><Bilingual th="ถัดไป" en="Next" /></Button>
              </form>
            ) : null}
          </section>

          <section hidden={step !== 2} aria-labelledby="step-2">
            <h2 id="step-2" tabIndex={-1} className="mb-4 text-h3">② <Bilingual th="ชำระเงิน" en="Payment" /></h2>
            {quote ? <PaymentQR promptpayId={quote.promptpay_id} name={quote.promptpay_name} amount={quote.total} /> : null}
            <div className="my-6">
              <Input key={slipKey} type="file" accept="image/*" label={<Bilingual th="อัปโหลดสลิป" en="Upload slip" />} onChange={pickSlip} />
              <p aria-live="polite" className="mt-2">
                {reading ? "…" : slip === null ? QR_NOT_READ : slip ? <Bilingual th="อ่าน QR จากสลิปแล้ว" en="Read the QR on your slip" /> : null}
              </p>
            </div>
            {quote ? (
              <CartTicket count={count} total={quote.total} action={
                <Button variant="secondary" disabled={!slip || reading} onClick={() => go(3)}><Bilingual th="ถัดไป" en="Next" /></Button>
              } />
            ) : null}
            {back(1)}
          </section>

          <section hidden={step !== 3} aria-labelledby="step-3">
            <h2 id="step-3" tabIndex={-1} className="mb-4 text-h3">③ <Bilingual th="ยืนยันคำสั่งซื้อ" en="Confirm order" /></h2>
            {checked ? (
              <div className="mb-6">
                <p>{checked.recipient.first_name} {checked.recipient.last_name} ({checked.recipient.nickname}) {checked.recipient.phone}</p>
                <p>{formatThaiAddress(checked.shipping_address)}</p>
              </div>
            ) : null}
            {quote ? (
              <CartTicket count={count} total={quote.total} action={
                <Button variant="secondary" disabled={!slip || placing} onClick={placeOrder}><Bilingual th="สั่งซื้อ" en="Place order" /></Button>
              } />
            ) : null}
            {back(2)}
          </section>
        </>
      ) : null}

      <Dialog open={placed} onClose={() => router.push("/")} title={<Bilingual th="สั่งซื้อแล้ว" en="Order placed" />}>
        <Button onClick={() => router.push("/")}><Bilingual th="กลับไปหน้าร้าน" en="Back to the shop" /></Button>
      </Dialog>
    </main>
  );
}
