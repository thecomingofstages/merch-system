import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

// D20: the privacy notice PDPA section 23 asks for. When anything below changes, change
// PRIVACY_VERSION in @merch/shared too, so new orders record the version their buyer accepted.
// Not legal advice: have someone who knows the PDPA read it before the sale opens.

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว · TCOS Merch",
};

const CONTACT = "official_account@thecomingofstages.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

const mail = (
  <a href={`mailto:${CONTACT}`} className="text-gold underline underline-offset-2">
    {CONTACT}
  </a>
);

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 leading-relaxed sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-fg-2">ร้าน TCOS Merch · ฉบับวันที่ 21 พฤศจิกายน 2569</p>
        <p className="text-fg-2">
          <a href="#english" className="text-gold underline underline-offset-2">English version below</a>
        </p>
      </header>

      <Section title="ใครเป็นผู้ดูแลข้อมูลของคุณ">
        <p>
          The Coming of Stages (เด็กไทยติดเวที) เป็นผู้ควบคุมข้อมูลส่วนบุคคลที่เก็บผ่านร้านนี้ ติดต่อเรื่องข้อมูลของคุณได้ที่ {mail}
        </p>
      </Section>

      <Section title="เราเก็บข้อมูลอะไรบ้าง">
        <ul className="list-disc pl-6">
          <li>อีเมล ชื่อ และนามสกุลจากบัญชี Google ตอนเข้าสู่ระบบ</li>
          <li>ข้อมูลที่กรอกตอนชำระเงิน: ชื่อ นามสกุล ชื่อเล่น เบอร์โทร LINE ID (ถ้าใส่) และที่อยู่จัดส่ง</li>
          <li>ข้อความใน QR บนสลิปโอนเงิน (เลขอ้างอิงรายการ) รูปสลิปไม่ถูกส่งออกจากเครื่องของคุณ เบราว์เซอร์อ่าน QR แล้วส่งมาเฉพาะข้อความ</li>
          <li>รายการสินค้า ยอดเงิน และเวลาที่สั่งซื้อ</li>
          <li>คุกกี้ <code>merch_session</code> ที่ทำให้คุณยังเข้าสู่ระบบอยู่ อายุไม่เกิน 30 วัน และของในตะกร้า ซึ่งเก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น</li>
        </ul>
      </Section>

      <Section title="เราใช้ข้อมูลทำอะไร">
        <ul className="list-disc pl-6">
          <li>จัดการคำสั่งซื้อ ส่งของ ส่งอีเมลยืนยันและแจ้งเลขพัสดุ และติดต่อคุณเมื่อคำสั่งซื้อมีปัญหาหรือต้องคืนเงิน ข้อนี้จำเป็นต่อการทำสัญญาซื้อขายกับคุณ (มาตรา 24(3))</li>
          <li>ตรวจการโอนเงิน และกันไม่ให้สลิปเดียวจ่ายได้หลายคำสั่งซื้อ (มาตรา 24(3))</li>
          <li>กรอกข้อมูลจากคำสั่งซื้อครั้งล่าสุดไว้ให้เมื่อคุณสั่งครั้งต่อไป เป็นประโยชน์โดยชอบด้วยกฎหมายของร้าน (มาตรา 24(5)) ขอให้ลบได้ทุกเมื่อ</li>
        </ul>
        <p>เราไม่ขายข้อมูลของคุณ และไม่ใช้ข้อมูลเพื่อโฆษณา</p>
      </Section>

      <Section title="ใครเห็นข้อมูลของคุณ">
        <ul className="list-disc pl-6">
          <li>ทีมงาน TCOS ที่ดูแลคำสั่งซื้อ ผ่านแดชบอร์ดที่เปิดได้เฉพาะในเครือข่ายส่วนตัวของทีม</li>
          <li>บริษัทขนส่ง ได้รับชื่อ เบอร์โทร และที่อยู่จัดส่ง เพื่อส่งของ</li>
          <li>ผู้ให้บริการที่ร้านใช้: Cloudflare (เว็บไซต์และเซิร์ฟเวอร์), MongoDB Atlas (ฐานข้อมูล), Google (การเข้าสู่ระบบ) และ Resend (การส่งอีเมล) ผู้ให้บริการเหล่านี้อาจเก็บหรือประมวลผลข้อมูลนอกประเทศไทย</li>
        </ul>
      </Section>

      <Section title="เราเก็บข้อมูลนานแค่ไหน">
        <ul className="list-disc pl-6">
          <li>ข้อมูลคำสั่งซื้อ: 1 ปีหลังการขาย จากนั้นลบหรือทำให้ระบุตัวตนไม่ได้</li>
          <li>บัญชีของคุณ (อีเมลและข้อมูลสำหรับกรอกอัตโนมัติ): 1 ปีหลังคำสั่งซื้อครั้งล่าสุด</li>
          <li>คุกกี้เข้าสู่ระบบ: ไม่เกิน 30 วัน</li>
        </ul>
      </Section>

      <Section title="สิทธิของคุณ">
        <p>
          ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 คุณขอดูหรือขอสำเนาข้อมูล ขอให้ส่งข้อมูลให้ผู้อื่น ขอแก้ไข ขอลบ ขอให้ระงับการใช้ และคัดค้านการใช้ข้อมูลของคุณได้
          ส่งคำขอมาที่ {mail} ร้านจะตอบภายใน 30 วัน ถ้าคิดว่าร้านใช้ข้อมูลของคุณไม่ถูกต้อง ร้องเรียนได้ที่สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล
        </p>
      </Section>

      <Section title="ถ้านโยบายนี้เปลี่ยน">
        <p>
          เราจะแก้วันที่ด้านบนของหน้านี้ ทุกคำสั่งซื้อบันทึกไว้ว่าคุณยอมรับนโยบายฉบับไหน และเมื่อไร
        </p>
      </Section>

      <hr className="border-line" />

      <div id="english" lang="en" className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h2 className="text-h2">Privacy policy</h2>
          <p className="text-fg-2">TCOS Merch · Version of 21 November 2026. The Thai version above is the main one.</p>
        </header>

        <Section title="Who looks after your data">
          <p>The Coming of Stages (เด็กไทยติดเวที) is the data controller for what this shop collects. Contact us about your data at {mail}.</p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-6">
            <li>Your email, first name and last name from your Google account when you sign in</li>
            <li>What you fill in at checkout: first name, last name, nickname, phone, LINE ID (if given) and shipping address</li>
            <li>The text in the QR on your transfer slip (the transaction reference). The slip image never leaves your device: your browser reads the QR and sends only its text</li>
            <li>The items, amounts and time of your order</li>
            <li>The <code>merch_session</code> cookie that keeps you signed in, for up to 30 days, and your cart, which stays in your browser</li>
          </ul>
        </Section>

        <Section title="What we use it for">
          <ul className="list-disc pl-6">
            <li>Handling your order: shipping it, emailing the confirmation and tracking number, and contacting you if something goes wrong or a refund is due. This is needed for the sale (section 24(3))</li>
            <li>Checking your payment, and stopping one slip from paying for two orders (section 24(3))</li>
            <li>Filling in your details from your last order next time, the shop&apos;s legitimate interest (section 24(5)). Ask us to delete them at any time</li>
          </ul>
          <p>We don&apos;t sell your data or use it for advertising.</p>
        </Section>

        <Section title="Who sees it">
          <ul className="list-disc pl-6">
            <li>TCOS staff who handle orders, on a dashboard that only opens on the team&apos;s private network</li>
            <li>The delivery company, which gets your name, phone and shipping address to deliver the parcel</li>
            <li>The services the shop runs on: Cloudflare (website and server), MongoDB Atlas (database), Google (sign-in) and Resend (email). They may store or process data outside Thailand</li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <ul className="list-disc pl-6">
            <li>Orders: 1 year after the sale, then deleted or made anonymous</li>
            <li>Your account (email and the details used for autofill): 1 year after your last order</li>
            <li>The sign-in cookie: up to 30 days</li>
          </ul>
        </Section>

        <Section title="Your rights">
          <p>
            Under Thailand&apos;s Personal Data Protection Act B.E. 2562 you can ask to see or copy your data, have it sent elsewhere, correct it, delete it, restrict its use, or object to its use.
            Send your request to {mail}; we reply within 30 days. If you think we have misused your data, you can complain to the Office of the Personal Data Protection Committee (PDPC).
          </p>
        </Section>

        <Section title="If this policy changes">
          <p>We update the date at the top. Every order records which version you accepted, and when.</p>
        </Section>
      </div>

      <p>
        <Link href="/" className="text-gold underline underline-offset-2">
          กลับไปหน้าร้าน · Back to the shop
        </Link>
      </p>
    </main>
  );
}
