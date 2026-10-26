# FRONTEND

Three Next.js 16 apps (`apps/client`, `apps/pos`, `apps/dashboard`) with Tailwind v4, plus two shared packages. Tasks are in [TASKS.md](TASKS.md). Screens follow the [POC](poc/merch-poc.drawio).

## Workspace layout
```
packages/
  shared/   @merch/shared  zod schemas + types, cartSubtotal(), promptpayPayload(), formatThaiAddress()
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
| `ProductPopup` | `product`, `stockOf(variant)`, `onAdd(variantId, count)`; caps the amount by `buy_limit` and stock | client, POS | 1.1 |
| `CartSummary` | `lines`, `shippingFee?`, `total?` (shipping hidden on POS) | client, POS | 1.1 |
| `useCart()` | add / setCount / remove / clear; lines grouped by product | client, POS | 1.2 |
| `PaymentQR` | `promptpayId`, `amount` | client, POS | 1.6 |
| `readSlipQrFromFile(file)` / `useSlipQrCamera()` | returns the payload string or null | client / POS | 1.7 |
| `CartTicket` | `count`, `total`, `action` (see design direction) | client tray, POS checkout pane, payment step | 1.1 |

## App screens

### apps/client (FE1)
| Screen | Notes | Task |
|---|---|---|
| Shop list | Header with cart count, one section per shop, `ProductCard` grid, `CartTicket` tray at the bottom | 1.3 |
| Product popup | `ProductPopup` | 1.1 |
| Checkout ① details | Sprint 1: plain form. Sprint 2: Google sign-in required first, autofill from `/me` (all fields editable, email read-only), postcode → tambon dropdown → amphoe/province auto, details field, live address preview with `formatThaiAddress()` | 1.4, 2.1, 2.3 |
| Checkout ② payment | `PaymentQR` with the quoted total, "Upload slip" → `readSlipQrFromFile` → show read / not read. If the QR can't be read, "Place order" stays disabled (D5). | 1.5 |
| Checkout ③ confirm | "Place order" → `POST /orders` → popup "Order placed" → Home | 1.5 |

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
| Sign in | Token field; token kept in `sessionStorage` | 1.8 |
| Dashboard | Empty state: "Sales overview comes later." | 1.8 |
| Products | Shops → products → variants table; Add stock; Transfer to POS | 1.9, 2.9 |
| Orders | List with new-order badge, detail, Submit for shipping | 2.8 |
| POS | Create, list, stock table, End sale | 2.9 |

## Design direction

**Subject.** A merch shop for The Coming of Stages, a Thai youth musical-theatre community. Buyers are Thai teens and young adults who arrive from an Instagram story on their phone. The main job is to pick items and pay **exactly the right amount**, which is what the old Google Form got wrong.

**Where it comes from.** TCOS's own merch photos: red stage props and a red striped cap, the purple-neon Hidden Saloon artwork, and the box-office ticket.

### Palette
| Name | Hex | Use |
|---|---|---|
| Curtain red | `#B3122E` | Primary actions and the cart ticket. Nothing decorative. |
| Stage ink | `#221B33` | Text. A deep aubergine instead of a grey near-black. |
| House lights | `#F6F5FB` | Page background. Slightly cool, so it doesn't read as the generic cream. |
| Saloon violet | `#5B3FD1` | Links and the selected variant outline |
| Spotlight | `#FFD23F` | Keyboard focus ring, and the fill behind a just-changed total. Always with ink text on top. |
| Rigging | `#DCD8E8` | Borders and dividers |

### Type
Both fonts support Thai and come from Google Fonts via `next/font` with `subsets: ["thai", "latin"]`:
- **Chonburi** (display, one weight): shop names, product names in the popup, and the total on the ticket. It has the look of a theatre marquee. Use only at 24px and above.
- **Anuphan** (text, 400/500/600): everything else.

Scale (1.25 ratio): 13 / 16 / 20 / 25 / 31 / 39 px. Body 16px, line-height 1.6 for Thai (Thai needs more than Latin because of stacked vowels and tone marks). Prices use `tabular-nums`; check that Anuphan renders it, and if not, accept proportional figures.

### The one bold element: the cart ticket
The cart tray (client), the checkout pane (POS) and the total on the payment step are drawn as a **box-office ticket stub**: curtain-red, with perforated notches cut into the left and right edges (CSS `radial-gradient` mask) and the total set in Chonburi. It is the thing people remember, and it sits on the number the whole system exists to get right. When the total changes, it flashes a Spotlight fill once (skipped under `prefers-reduced-motion`). This is the only motion that isn't a direct response to a tap.

Everything else stays quiet:
- **Products have no card boxes.** Show the image (4px radius), then the name and price below on the page background. No shadows, no borders.
- **Radius follows hierarchy:** inputs and buttons 8px, images 4px, the popup sheet 16px on the top corners only. Not one radius everywhere.
- **Only the popup and dialogs have a shadow.**
- **Sold out:** the image goes 40% opacity and the price is replaced with "สินค้าหมด". No ribbons or badges.
- **The dashboard skips the ticket entirely.** It's a staff tool: dense tables, Anuphan only, curtain red only for primary buttons.

### Layout
```
Client (phone)                    POS (tablet, landscape)
┌──────────────────────┐          ┌──────────────────────┬─────────────┐
│ TCOS            ตะกร้า 2│          │ จุดขาย: [Siam ▾]       │  ╭───────╮  │
│                      │          │                      │  ┊ ticket┊  │
│ Shop name (Chonburi) │          │  [img] [img] [img]   │  ┊ lines ┊  │
│ [img]      [img]     │          │  name   name  name   │  ┊ total ┊  │
│ name ฿29   name ฿119 │          │  ฿29    ฿119  ฿269   │  ╰───────╯  │
│                      │          │                      │ [ชำระเงิน]   │
├─╮──────────────────╭─┤          └──────────────────────┴─────────────┘
│ ┊ 2 ชิ้น  ฿270  ชำระเงิน ┊ │ ← ticket tray
└─╯──────────────────╰─┘
```
Text is left-aligned throughout, except the total on the ticket, which is right-aligned so the digits line up.

### What I changed after checking against the generic defaults
- First draft used a cream background. Changed it to the cool "House lights" tint, because cream plus a red accent is the most common generated look.
- First draft themed every surface as a theatre programme. Cut that back to the ticket only, so the theme carries information (the money) instead of decorating everything.
- Removed ALL-CAPS section labels and a monospace face for prices. Prices use the text font with tabular figures instead.
- The checkout keeps ①②③ numbering because it really is a sequence. Nowhere else uses numbered markers.

### Copy
Thai first, sentence case, plain verbs. An action keeps its name through the flow.

| Situation | Text |
|---|---|
| Add button | ใส่ตะกร้า |
| Go to checkout | ชำระเงิน |
| Submit online order | สั่งซื้อ → popup "สั่งซื้อแล้ว" |
| POS manual verify | ยืนยันสลิปด้วยตนเอง |
| Duplicate slip | สลิปนี้ใช้กับคำสั่งซื้ออื่นแล้ว กรุณาอัปโหลดสลิปของคำสั่งซื้อนี้ |
| Out of stock at order | สินค้าบางรายการหมดแล้ว กรุณาแก้ไขตะกร้า |
| QR not read from slip | อ่าน QR จากสลิปไม่ได้ ลองอัปโหลดรูปที่ชัดขึ้น |
| Empty cart | ยังไม่มีสินค้าในตะกร้า |

Have a native speaker on the team check the Thai before release.

### Quality floor (not optional)
Works from 360px wide; visible Spotlight focus ring on every control; respects `prefers-reduced-motion`; text contrast at least 4.5:1 (Curtain red and Saloon violet both pass on House lights); every image has alt text; tap targets at least 44px.
