"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
const PAID_OUT_OF_STOCK = "สินค้าบางรายการหมดก่อนบันทึกคำสั่งซื้อ ร้านจะติดต่อทาง LINE เพื่อคืนเงินที่โอนมา";
const SIGNED_OUT = "หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง";
const NO_TAMBON = "ไม่พบตำบลของรหัสไปรษณีย์นี้";
const cartUpdated = (names: string) => `สินค้าบางรายการหมด เราปรับตะกร้าให้แล้ว: ${names}`;

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
    error?: string;
  } | null>(null);
  const [stockRun, setStockRun] = useState(0);
  const cart = useRef({ lines, sets, setCount, removeSet });
  const hasItems = lines.length + sets.length > 0;
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
        setNotice((prev) => [prev, cartUpdated(names)].filter(Boolean).join(" "));
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

  const back = (to: 1 | 2) => <Button variant="secondary" className="mt-6" onClick={() => go(to)}>กลับ</Button>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-h2">ชำระเงิน</h1>
        <Link href="/" className="inline-flex min-h-11 items-center text-gold">กลับ</Link>
      </header>

      <section aria-label="สรุปคำสั่งซื้อ" aria-busy={hasItems && !currentPricing} className="mb-8 rounded-xl border border-line bg-surface p-5">
        <CartSummary lines={quote?.lines ?? lines} sets={quote?.promotions ?? sets} shippingFee={quote?.shipping_fee} total={quote?.total} />
        {currentPricing?.error ? <p role="alert" className="mt-4">{currentPricing.error}</p> : null}
      </section>

      {notice ? <p role="alert" className="mb-6 text-danger">{notice}</p> : null}

      {hasItems ? (
        <>
          <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-fg-3 [&>[aria-current=step]]:font-medium [&>[aria-current=step]]:text-fg">
            <li aria-current={step === 1 ? "step" : undefined}>① กรอกข้อมูล</li>
            <li aria-current={step === 2 ? "step" : undefined}>② ชำระเงิน</li>
            <li aria-current={step === 3 ? "step" : undefined}>③ ยืนยันคำสั่งซื้อ</li>
          </ol>

          <section hidden={step !== 1} aria-labelledby="step-1" aria-busy={me === undefined}>
            <h2 id="step-1" tabIndex={-1} className="mb-4 text-h3">① กรอกข้อมูล</h2>
            {me === null ? (
              <>
                <p className="mb-4">เข้าสู่ระบบด้วย Google ก่อนกรอกข้อมูล</p>
                <GoogleSignIn onToken={signIn} />
              </>
            ) : me ? (
              <form noValidate onSubmit={next}>
                <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <Input {...field("first_name")} label="ชื่อ" autoComplete="given-name" required />
                  <Input {...field("last_name")} label="นามสกุล" autoComplete="family-name" required />
                  <Input {...field("nickname")} label="ชื่อเล่น" autoComplete="nickname" required />
                  <Input {...field("phone")} label="เบอร์โทร" type="tel" autoComplete="tel" required />
                  <Input {...field("line_id")} label="LINE ID" />
                  <Input name="email" label="อีเมล" type="email" value={me.email} readOnly />
                </fieldset>

                <fieldset className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                  <legend className="mb-4 text-h4 font-semibold">ที่อยู่จัดส่ง</legend>
                  <Input {...field("postal_code")} error={errors.postal_code ?? postcodeError} label="รหัสไปรษณีย์" inputMode="numeric" maxLength={5} autoComplete="shipping postal-code" required />
                  <Select
                    name="tambon"
                    label="ตำบล/แขวง"
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
                  <Input name="amphoe" label="อำเภอ/เขต" value={place?.amphoe ?? ""} readOnly />
                  <Input name="province" label="จังหวัด" value={place?.province ?? ""} readOnly />
                  <Input {...field("details")} label="บ้านเลขที่ ซอย ถนน" autoComplete="shipping street-address" required className="w-full" />
                </fieldset>

                {place && values.details.trim() ? (
                  <p aria-live="polite" className="mt-4">
                    {formatThaiAddress({ ...place, details: values.details.trim(), postal_code: values.postal_code })}
                  </p>
                ) : null}

                <Button type="submit" disabled={!quote} className="mt-6">ถัดไป</Button>
              </form>
            ) : null}
          </section>

          <section hidden={step !== 2} aria-labelledby="step-2">
            <h2 id="step-2" tabIndex={-1} className="mb-4 text-h3">② ชำระเงิน</h2>
            {quote ? <PaymentQR promptpayId={quote.promptpay_id} name={quote.promptpay_name} amount={quote.total} /> : null}
            <div className="my-6">
              <Input key={slipKey} type="file" accept="image/*" label="อัปโหลดสลิป" onChange={pickSlip} />
              <p aria-live="polite" className="mt-2">
                {reading ? "…" : slip === null ? QR_NOT_READ : slip ? "อ่าน QR จากสลิปแล้ว" : null}
              </p>
            </div>
            {quote ? (
              <CartTicket count={count} total={quote.total} action={
                <Button variant="secondary" disabled={!slip || reading} onClick={() => go(3)}>ถัดไป</Button>
              } />
            ) : null}
            {back(1)}
          </section>

          <section hidden={step !== 3} aria-labelledby="step-3">
            <h2 id="step-3" tabIndex={-1} className="mb-4 text-h3">③ ยืนยันคำสั่งซื้อ</h2>
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
        <Button onClick={() => router.push("/")}>กลับไปหน้าร้าน</Button>
      </Dialog>
    </main>
  );
}
