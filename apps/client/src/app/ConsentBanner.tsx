"use client";

import { Button, useCart } from "@merch/ui";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { consentSnapshot, parseConsent, setConsent, subscribeConsent } from "../lib/consent";

// D20 (PDPA s.19): the usage-statistics question, on its own. It never blocks the shop, yes and
// no look the same, nothing is tracked before a yes, and the footer button asks again any time.
const OPEN_EVENT = "merch:consent-open";
// The server can't know the answer (it lives in the browser), so it renders no banner.
const ON_SERVER = "server";

export function ConsentBanner() {
  const cart = useCart();
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribeConsent, consentSnapshot, () => ON_SERVER);
  const current = raw === ON_SERVER ? undefined : (parseConsent(raw)?.accepted ?? null);
  const [reopened, setReopened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reopen = () => {
      setFailed(false);
      setReopened(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  async function choose(accepted: boolean) {
    setSaving(true);
    setFailed(false);
    try {
      await setConsent(accepted);
      setReopened(false);
    } catch {
      setFailed(true); // a yes that couldn't be recorded doesn't count
    } finally {
      setSaving(false);
    }
  }

  // Asked when there is no answer for this policy version, or when the footer button asks again.
  if (current === undefined || (current !== null && !reopened)) return null;
  // On the shop page the cart ticket floats at the bottom too; sit above it.
  const lift = pathname === "/" && cart.count > 0 ? "bottom-28" : "bottom-0";

  return (
    <section aria-labelledby="consent-title" className={`fixed inset-x-0 ${lift} z-50 px-4 pb-4 sm:px-6`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xl shadow-sunk/60">
        <h2 id="consent-title" className="text-h4 font-semibold">
          ขอเก็บสถิติการใช้งานแบบไม่ระบุตัวตนได้ไหม
        </h2>
        <p className="text-small text-fg-2">
          ร้านอยากรู้ว่าสินค้าไหนถูกเห็น เปิดดู ใส่ตะกร้า และสั่งซื้อ เพื่อจัดร้านให้ดีขึ้น ใช้รหัสสุ่ม ไม่เก็บชื่อ อีเมล หรือข้อมูลที่กรอกตอนสั่งซื้อ
          ไม่ยอมรับก็ซื้อของได้ตามปกติ และเปลี่ยนใจได้ทุกเมื่อที่ปุ่ม &quot;การเก็บสถิติการใช้งาน&quot; ด้านล่างของหน้า{" "}
          <a href="/privacy#analytics" target="_blank" rel="noopener" className="text-gold underline underline-offset-2">
            อ่านนโยบายความเป็นส่วนตัว
          </a>
        </p>
        {current !== null ? <p className="text-small text-fg-2">ตอนนี้: {current ? "ยอมรับ" : "ไม่ยอมรับ"}</p> : null}
        {failed ? (
          <p role="alert" className="text-small text-danger">
            บันทึกไม่สำเร็จ ยังไม่ได้เก็บสถิติ ลองอีกครั้ง
          </p>
        ) : null}
        {/* Same style and size for both: declining must be as easy as accepting. */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={saving} onClick={() => choose(false)}>
            ไม่ยอมรับ
          </Button>
          <Button variant="secondary" disabled={saving} onClick={() => choose(true)}>
            ยอมรับ
          </Button>
        </div>
      </div>
    </section>
  );
}

/** In the footer: asks the question again, so the answer can be changed as easily as it was given. */
export function ConsentSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="inline-flex min-h-11 items-center text-fg-2 underline underline-offset-2 hover:text-fg"
    >
      การเก็บสถิติการใช้งาน
    </button>
  );
}
