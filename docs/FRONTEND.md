# FRONTEND

Three Next.js 16 apps (`apps/client`, `apps/pos`, `apps/dashboard`) with Tailwind v4, plus two shared packages. Tasks are in [TASKS.md](TASKS.md). Screens follow the [POC](poc/merch-poc.drawio).

## Workspace layout
```
packages/
  shared/   @merch/shared  zod schemas + types, cartSubtotal(), isPromptpayId(), formatThaiAddress()
  ui/       @merch/ui      React components, useCart, slip QR reader, Tailwind theme (styles.css)
apps/
  client/     storefront (phones first)            Cloudflare Workers (OpenNext)
  pos/        on-site sale (tablet, landscape)     private VM, pm2, Tailscale only, HTTPS
  dashboard/  back office (desktop)                private VM, pm2, Tailscale only
```
- Each app's `next.config.ts` adds `transpilePackages: ["@merch/ui", "@merch/shared"]`.
- Each app's `globals.css` does `@import "@merch/ui/styles.css";` and `@source "../../../../packages/ui/src";` so Tailwind sees the classes used inside `packages/ui` (adjust the relative path per app).
- API base URL comes from `NEXT_PUBLIC_API_URL`. Request and response types come from `@merch/shared`; never redefine them in an app.

## Rules every app follows
1. **Never compute the amount to pay in the browser.** Show `cartSubtotal()` while browsing, but the QR and the "Total" on the payment step use the number from `POST /quote`. The server recomputes it again on order.
2. **Money is whole baht (`int`)**, displayed with the shared `<Price>` component.
3. **Shared components take data as props and never fetch.** The client passes `online_stock`; the POS passes `pos_stock`. This is what makes reuse work.
4. Build against `@merch/shared` types and local fixtures until the endpoint exists, so the single BE never blocks you.

## Shared components (`@merch/ui`)

| Component / hook | Props (summary) | Used by | Task |
|---|---|---|---|
| `Button`, `Input`, `Select`, `Dialog`, `QuantityStepper`, `Price` | standard | all | F8 |
| `ProductCard` | `product`, `stockOf(variant)`, `onOpen` | client, POS | 1.1 |
| `ProductPopup` | `product`, `stockOf(variant)`, optional `inCart(variantId)`, `onAdd(variantId, count)`; caps additions by stock, `buy_limit`, and the quantity already in the cart | client, POS | 1.1 |
| `CartSummary` | `lines`, `sets?`, `shippingFee?`, `total?` (shipping hidden on POS) | client, POS | 1.1 |
| `useCart()` | add / setCount / remove / clear, `sets` with addSet / removeSet (D13); lines grouped by product | client, POS | 1.2 |
| `PaymentQR` | `promptpayId`, `name`, `amount` (all from `POST /quote`); an `<img>` from `https://promptpay.io/<id>/<amount>.png` (D14) with the account name and number under it | client, POS | 1.6 |
| `readSlipQrFromFile(file)` / `useSlipQrCamera()` | returns the payload string or null | client / POS | 1.7 |
| `CartTicket` | `count`, `total`, `action` (see design direction) | client tray, POS checkout pane, payment step | 1.1 |
| `PromotionCard`, `PromotionPopup` | `promotion`, `stockOf(variant)`, `onOpen` / `onAdd(set)`; the popup has a stepper per allowed variant of each item, and "ใส่ตะกร้า" stays disabled until every item is filled | client (POS with 2.6) | D13 |

## App screens

### apps/client (FE1)
| Screen | Notes | Task |
|---|---|---|
| Shop list | Header with cart count, promotion sets first (`PromotionCard` grid, `PromotionPopup`), one section per shop, `ProductCard` grid, `CartTicket` tray at the bottom | 1.3 |
| Product popup | `ProductPopup` | 1.1 |
| Checkout ① details | Sprint 1: plain form. Sprint 2: Google sign-in required first, autofill from `/me` (all fields editable, email read-only), postcode → tambon dropdown → amphoe/province auto, details field, live address preview with `formatThaiAddress()` | 1.4, 2.1, 2.3 |
| Checkout ② payment | `PaymentQR` with a total quoted again on the way to ②, "Upload slip" → `readSlipQr` → show read / not read. If the QR can't be read, "Place order" stays disabled (D5). | 1.5 |
| Checkout ③ confirm | A checkbox "ฉันได้อ่านและยอมรับนโยบายความเป็นส่วนตัว / I have read and accept the privacy policy" (link opens `/privacy` in a new tab) must be ticked first (D20). "Place order" → `POST /orders` with `privacy_version` → popup "Order placed" → Home. `OUT_OF_STOCK` here means the buyer already paid: say the shop will refund over LINE (D11), and ask for a new slip. | 1.5 |
| Stock re-check | While in checkout, `GET /catalog` every 15 s (`stockShortfalls()`): a line the stock no longer covers is reduced or removed, with a message, and the quote follows. Polling, because the server can't push. | 1.5 |

### apps/pos (FE3)
| Screen | Notes | Task |
|---|---|---|
| Rotate prompt | Shown in portrait | 2.6 |
| Sell | POS location select (persisted in `localStorage`), product grid with `pos_stock`, `CartSummary` + Checkout | 2.6 |
| Pay | `PaymentQR`, camera scan with `useSlipQrCamera`, Back, Manual verify (confirm dialog) → sale saved → back to Sell with an empty cart | 2.7 |

The POS never calls `apps/server` directly. Its browser calls the POS's own Next.js server (`/api/...`), which adds `ADMIN_ACCESS_TOKEN` from the VM's env and forwards the call (F7). Never put the token in a `NEXT_PUBLIC_` variable.

### apps/dashboard (FE2)
| Screen | Notes | Task |
|---|---|---|
| (no sign-in) | `ADMIN_ACCESS_TOKEN` is in the dashboard's server-side `.env`; the browser calls `/api/admin/*`, and the dashboard's own server adds the token and forwards to `apps/server` (D15). Tailscale is what keeps others out | 1.8 |
| Dashboard | Empty state: "Sales overview comes later." | 1.8 |
| Products | Shop dropdown, the chosen shop's name with Rename and Archive → products → variants table; every image field has "Upload from device" (shrunk to 1600 px WebP in the browser, stored in R2; a pasted link is copied into R2 on save, D17); Add stock; Transfer to POS | 1.9, 2.9 |
| Promotions | Sets: name, description, image URL, price, on/off switch, items (a product from any shop, its allowed variants, a count). Archiving a product or variant on Products lists the sets it deletes or changes first | D13 |
| Orders | List with new-order badge, detail with the slip QR drawn again from `slip_qr_data` (`SlipQrCode`) for the admin to scan with a banking app's slip check, Submit for shipping | 2.8 |
| POS | Create, list, stock table, End sale | 2.9 |

## Design direction

**Subject.** A merch shop for The Coming of Stages, a Thai youth musical-theatre community. Buyers are Thai teens and young adults who arrive from an Instagram story on their phone. The main job is to pick items and pay **exactly the right amount**, which is what the old Google Form got wrong.

**Where it comes from (D18).** The other TCOS sites: [enroll.thecomingofstages.com](https://enroll.thecomingofstages.com) and the portfolio site. A black-box theatre with the house lights down: warm near-black surfaces, warm off-white text, gold programme foil. The TCOS logo (white) and "Merch" head every page. The design pass followed the [unslop](https://github.com/heydamir/unslop) skill by Damir Sokolovsky (CC BY 4.0).

### Palette
Dark only. The tokens are in `packages/ui/src/styles.css`; no colour value lives anywhere else.

| Token | Hex | Use |
|---|---|---|
| `sunk` | `#0e0e0c` | Deepest surface: the shop header, the dashboard sidebar |
| `canvas` | `#131311` | Page background, and text on gold |
| `surface` | `#1b1b19` | Cards, popups, dialogs |
| `raised` | `#2a2a27` | Inputs, steppers, secondary buttons, table heads, the active row |
| `line` | `#3a3833` | Hairlines and dividers |
| `fg` / `fg-2` / `fg-3` | `#f4f0ea` / `#bdb6a9` / `#8f897e` | Primary, secondary and muted text (muted only for meta and captions) |
| `gold` (`gold-hover`) | `#d8b85a` (`#e5c66e`) | The one accent, as on the enrollment site: primary actions, the cart ticket, links, the selection, the basket count. Canvas text on top |
| `danger` | `#f07a72` | Errors and refusals |
| `spotlight` | `#f5dc8f` | Keyboard focus ring, and the fill behind a just-changed total. Canvas text on top |

### Type
Both fonts support Thai and come from Google Fonts via `next/font` with `subsets: ["thai", "latin"]`, set on `<html>` (the tokens read them on `:root`):
- **Prompt** (500/600): headings, the "Merch" wordmark and the total on the ticket, as on the other TCOS sites.
- **Sarabun** (400/500/600): everything else, chosen to be clear and easy to read.

Scale: 13 / 16 / 18 / 22 / 28 / 36 px. Body 16px, line-height 1.6 for Thai (Thai needs more than Latin because of stacked vowels and tone marks). Prices use `tabular-nums`.

### The one bold element: the cart ticket
The total in the shop, on the payment step and in the POS checkout pane is drawn as a **box-office ticket stub**: gold, with perforated notches cut into the left and right edges (CSS `radial-gradient` mask) and the total set in Prompt. It sits on the number the whole system exists to get right. In the shop it floats over the page with no tray behind it, and only appears (one short fade and rise) once the cart holds something. When the total changes, it flashes a Spotlight fill once (skipped under `prefers-reduced-motion`).

Everything else stays quiet:
- **The header** is the logo, "Merch", and a basket icon (lucide, 1.5 stroke) that goes to checkout. Its gold count badge shows only when the cart holds something.
- **Products have no card boxes.** Show the image (4px radius), then the name and the price (secondary text) below on the page background.
- **Radius follows hierarchy:** inputs and buttons 8px, images 4px, cards 12px, the popup sheet 16px on the top corners only.
- **Depth comes from surface steps and hairlines.** Only popups, dialogs and the floating ticket have a shadow.
- **Sold out:** the image goes 40% opacity and the price is replaced with "สินค้าหมด" in muted text. No ribbons or badges.
- **The dashboard skips the ticket.** It's a staff tool: dense tables on `surface`, the sidebar on `sunk` with the logo, gold only for primary buttons and the new-order count.

### Layout
```
Client (phone)                    POS (tablet, landscape)
┌──────────────────────┐          ┌──────────────────────┬─────────────┐
│ [logo] Merch [bskt 2]│          │ จุดขาย: [Siam ▾]       │  ╭───────╮  │
│                      │          │                      │  ┊ ticket┊  │
│ Shop name (Prompt)   │          │  [img] [img] [img]   │  ┊ lines ┊  │
│ [img]      [img]     │          │  name   name  name   │  ┊ total ┊  │
│ name ฿29   name ฿119 │          │  ฿29    ฿119  ฿269   │  ╰───────╯  │
│                      │          │                      │ [ชำระเงิน]   │
│ ╭─┊ 2 ชิ้น ฿270 ชำระเงิน ┊─╮ │ ← floats, only with items └──────────────────────┴─────────────┘
└──────────────────────┘
```
Text is left-aligned throughout, except the total on the ticket, which is right-aligned so the digits line up.

### What changed after checking against the generic defaults
- The first design was light with a red accent and Chonburi/Anuphan. It moved to the TCOS family's dark and gold so the shop reads as part of TCOS, with the theme still carried only by the ticket.
- Removed ALL-CAPS section labels and a monospace face for prices. Prices use the text font with tabular figures instead.
- The checkout keeps ①②③ numbering because it really is a sequence. Nowhere else uses numbered markers.
- "ตะกร้า 0" read as text, not a control: it is now the basket icon with a count.

### Copy
Thai first, sentence case, plain verbs. An action keeps its name through the flow.

The shop is in Thai only. The English column below is for the team (what each line means), not shown to buyers. Server error messages, form-field errors from the zod schemas, the buyer emails and the dashboard are not translated yet.

| Situation | Thai | English (meaning, not shown) |
|---|---|---|
| Add button | ใส่ตะกร้า | Add to cart |
| Go to checkout, its heading | ชำระเงิน | Checkout |
| Sold out | สินค้าหมด | Sold out |
| Product popup | ตัวเลือก · จำนวน · ราคารวม | Option · Quantity · Total |
| Buy limit reached | จำกัด N ชิ้นต่อคำสั่งซื้อ ใส่ตะกร้าครบแล้ว | You can buy up to N per order, and they're already in your cart. |
| Promotion item | {product}: เลือก N ชิ้น · เลือกแล้ว 1 จาก 2 | Pick N · 1 of 2 picked |
| Cart summary | ค่าส่ง · ยอดรวม | Shipping · Total |
| Empty cart | ยังไม่มีสินค้าในตะกร้า | Your cart is empty |
| Checkout steps | ① กรอกข้อมูล · ② ชำระเงิน · ③ ยืนยันคำสั่งซื้อ | Your details · Payment · Confirm order |
| Back, Next | กลับ · ถัดไป | Back · Next |
| Sign in | เข้าสู่ระบบด้วย Google ก่อนกรอกข้อมูล | Sign in with Google to fill in your details |
| Signed out mid-order | หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง | You were signed out. Please sign in again. |
| Details form | ชื่อ · นามสกุล · ชื่อเล่น · เบอร์โทร · LINE ID · อีเมล | First name · Last name · Nickname · Phone · Email |
| Address | ที่อยู่จัดส่ง · รหัสไปรษณีย์ · ตำบล/แขวง · อำเภอ/เขต · จังหวัด · บ้านเลขที่ ซอย ถนน | Shipping address · Postal code · Subdistrict · District · Province · House no., soi, road |
| Postcode with no tambon | ไม่พบตำบลของรหัสไปรษณีย์นี้ | No subdistrict found for this postal code |
| Payment | บัญชีพร้อมเพย์ · อัปโหลดสลิป · อ่าน QR จากสลิปแล้ว | PromptPay account · Upload slip · Read the QR on your slip |
| QR not read from slip | อ่าน QR จากสลิปไม่ได้ ลองอัปโหลดรูปที่ชัดขึ้น | We couldn't read the QR on this slip. Try a sharper photo. |
| Duplicate slip | สลิปนี้ใช้กับคำสั่งซื้ออื่นแล้ว กรุณาอัปโหลดสลิปของคำสั่งซื้อนี้ | This slip was already used for another order. Please upload the slip for this order. |
| Out of stock at order | สินค้าบางรายการหมดแล้ว กรุณาแก้ไขตะกร้า | Some items have sold out. Please update your cart. |
| Cart updated in checkout | สินค้าบางรายการหมด เราปรับตะกร้าให้แล้ว: {names} | Some items sold out, so we updated your cart: {names} |
| Paid, then sold out | สินค้าบางรายการหมดก่อนบันทึกคำสั่งซื้อ ร้านจะติดต่อทาง LINE เพื่อคืนเงินที่โอนมา | Some items sold out before we could save your order. The shop will contact you on LINE to refund your payment. |
| Submit online order | สั่งซื้อ → popup "สั่งซื้อแล้ว" → กลับไปหน้าร้าน | Place order → "Order placed" → Back to the shop |
| POS manual verify | ยืนยันสลิปด้วยตนเอง | – |

Have a native speaker on the team check the Thai before release.

### Quality floor (not optional)
Works from 360px wide; visible Spotlight focus ring on every control; respects `prefers-reduced-motion`; text contrast at least 4.5:1 (Curtain red and Saloon violet both pass on House lights); every image has alt text; tap targets at least 44px.
