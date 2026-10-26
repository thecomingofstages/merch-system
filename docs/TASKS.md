# TCOS merch: task briefs

One brief per task. Hand a developer (or their AI tool) the brief together with the docs it names: [FRONTEND.md](FRONTEND.md), [BACKEND.md](BACKEND.md) and the [POC](poc/merch-poc.drawio).

- **Team:** **DO** (DevOps, project lead) does setup and configuration. **BE** does models, endpoints and business rules. **FE1** (client), **FE2** (dashboard), **FE3** (POS, payment helpers, emails) do components and pages.
- **Sprints:** two, one week each.
- **Paths:** relative to the repo root.
- **Sizes:** rough guesses. S is about a day, M two to three days, L about a week.
- **Shared parts:** marked **shared**. Other tasks build on them, so their owner reviews any change to them.

## Order

1. **Foundation (F1–F8) comes first**, in the first days of sprint 1. F1 and F3 unblock the most. F5's fixtures let every page run without the server.
2. **Sprint 1 (1.1–1.9)** and the sprint 1 server tasks run in parallel after the foundation. Goal: one online purchase works end to end, with a plain details form and no emails.
3. **Sprint 2 (2.1–2.10)** adds Google sign-in, the address lookup, emails, the orders back office and the POS.
4. **Server (S1–S11)** runs alongside. X3 switches each page from fixtures to the real API when its endpoint is ready.
5. **Infrastructure (I1–I9)** is DO's, alongside the foundation.

## Decisions

| # | Decision |
|---|---|
| D1 | Products: separate `products` collection with `shop_id` (recommended in BACKEND.md). **Still open: BE confirms before S1.** |
| D2 | A **new Atlas project** with a **free (M0) cluster**, separate from the enrollment site's project. Every Atlas cluster is a replica set, so transactions work. The merch server never connects to the enrollment cluster. |
| D3 | The Google Cloud project is owned by the TCOS Google account; DO sets it up. |
| D4 | **No enrollment data.** The merch `users` collection starts empty and keeps the draft schema. A buyer's first Google sign-in creates their user; later sign-ins autofill from it. |
| D5 | Client: if the slip's QR can't be read, block the order. |
| D6 | POS authenticates with `ADMIN_ACCESS_TOKEN`, set as an env var on the POS's VM. |
| D7 | New dependencies approved: QR rendering, QR decoding, `google-auth-library`, `resend`, `mongoose`, `express`. |
| D8 | `apps/client` and `apps/server` on Cloudflare Workers. `apps/dashboard` and `apps/pos` on a private VM, reachable only over Tailscale. |
| D9 | `apps/dashboard` and `apps/pos` run under `pm2`. **Still open: CI platform** (affects I3). |

## Open questions in these briefs

Leave these as `TODO(<question>)` until the project lead answers:

1. **Names** of the new Atlas project, cluster and database. Affects I2.
2. **CI platform.** Affects I3.
3. **Mongoose on Workers:** not yet confirmed to work. F3 checks it. If it doesn't, use the official `mongodb` driver, as the portfolio project does.
4. **Workers plan:** free or paid. Affects I4.
5. **Domains** for the client and the server. They must share one parent domain (see I6).

---

## Foundation (sprint 1, first days)

### F1. Workspace
- **Size:** S · **Depends on:** I1 · **Owner:** DO · **shared**
- **Read:** FRONTEND.md "Workspace layout"
- **Files:** root `package.json`, root `.gitignore`, `packages/ui/`, `packages/shared/`, each app's `package.json`
- **Do:**
  - Root npm workspace with `apps/*` and `packages/*`; one lockfile at the root instead of one per app.
  - Root `.gitignore` covers `node_modules/` and `.next/`.
  - One React and one TypeScript version across all apps (`apps/pos` currently pins `react 19.3.0`).
  - Move `apps/pos/app/` to `apps/pos/src/app/`, matching the other apps.
  - Commit the `AGENTS.md` files that `next dev` creates.
- **Done when:** `npm install` at the root works, and every app builds.

### F2. App scaffolding and design tokens
- **Size:** S · **Depends on:** F1 · **Owner:** DO · **shared**
- **Read:** FRONTEND.md "Workspace layout", "Design direction" (Palette, Type)
- **Files:** `packages/ui/src/styles.css`, each app's `next.config.ts`, `globals.css`, `layout.tsx`, `.env.example`
- **Do:**
  - Put the palette from FRONTEND.md "Palette" in `packages/ui/src/styles.css` as Tailwind theme tokens.
  - Load Chonburi and Anuphan with `next/font/google`, with the `thai` and `latin` subsets.
  - In each app: `transpilePackages`, the `@import` and `@source` lines, `NEXT_PUBLIC_API_URL` in `.env.example`.
- **Done when:** a test page in each app shows a heading in Chonburi and body text in Anuphan, using the tokens, and imports one component from `@merch/ui`.

### F3. Server skeleton on Workers
- **Size:** M · **Depends on:** F1, I2 · **Owner:** DO · **shared**
- **Read:** BACKEND.md "Stack", "Hosting", "Folder layout", "Environment"
- **Files:** `apps/server/wrangler.jsonc`, `apps/server/src/index.ts`, `src/app.ts`, `src/env.ts`, `src/db.ts`, `.dev.vars.example`
- **Do:**
  - Express on Workers with `nodejs_compat` listed explicitly.
  - Read and check the environment at start; list every secret in `.dev.vars.example` with empty values.
  - Connect to the merch database on the new cluster.
  - Check that Mongoose works on Workers. If it doesn't, switch `db.ts` to the official `mongodb` driver and tell BE before S1.
  - The error format from BACKEND.md "API".
- **Done when:** `npx wrangler dev` starts the server locally, and `GET /health` reads from MongoDB.

### F4. Shared schemas and types
- **Size:** M · **Depends on:** F1 · **Owner:** FE2 (BE reviews) · **shared**
- **Read:** BACKEND.md "Data model", "Shared zod schemas", "API"
- **Files:** `packages/shared/src/schemas/`
- **Done when:** every collection and every request/response in BACKEND.md "API" has a zod schema and an inferred type, and BE has approved them.

### F5. Fixtures and API helper
- **Size:** S · **Depends on:** F4 · **Owner:** FE2 · **shared**
- **Read:** FRONTEND.md "Rules every app follows"
- **Files:** `packages/shared/src/fixtures/`, each app's `src/lib/api.ts`
- **Do:**
  - Fixtures for shops, products and variants, including a sold-out variant, a variant with `buy_limit`, and a hidden variant (`visible_to_online: false`).
  - One API helper per app that reads `NEXT_PUBLIC_API_URL`. An environment flag switches between fixtures and the real API.
- **Done when:** each app can render its first page from fixtures.

### F6. Admin auth and CORS
- **Size:** S · **Depends on:** F3 · **Owner:** DO
- **Read:** BACKEND.md "Auth details"
- **Files:** `apps/server/src/middleware/adminAuth.ts`, `src/app.ts`
- **Done when:** every `/admin/*` route answers `401` without a valid `ADMIN_ACCESS_TOKEN`, and only the origins in `CORS_ORIGINS` are allowed.

### F7. POS token forwarding
- **Size:** S · **Depends on:** F2, F6 · **Owner:** DO · **Sprint:** 2
- **Read:** FRONTEND.md "apps/pos"; BACKEND.md "Auth details"
- **Files:** `apps/pos/src/app/api/[...path]/route.ts`, `apps/pos/.env.example`
- **Do:** the POS browser calls its own Next.js server, which adds `ADMIN_ACCESS_TOKEN` from the VM's env and forwards the call to `apps/server`. The token is never a `NEXT_PUBLIC_` variable.
- **Done when:** the token does not appear in any file the browser downloads.

### F8. Base components
- **Size:** S · **Depends on:** F2 · **Owner:** FE3 · **shared**
- **Read:** FRONTEND.md "Shared components", "Design direction"
- **Files:** `packages/ui/src/` (Button, Input, Select, Dialog, QuantityStepper, Price)
- **Done when:** each has a visible focus ring and works with the keyboard, and `Price` formats whole baht.

---

## Sprint 1: one online purchase

### 1.1 ProductCard, ProductPopup, CartSummary, CartTicket
- **Size:** M · **Depends on:** F5, F8 · **Owner:** FE1 · **shared**
- **Read:** FRONTEND.md "Shared components", "The one bold element: the cart ticket"; POC page 1 (screens A, B)
- **Files:** `packages/ui/src/ProductCard.tsx`, `ProductPopup.tsx`, `CartSummary.tsx`, `CartTicket.tsx`
- **Do:** props only, no data fetching. Stock comes from a `stockOf(variant)` prop, so the client passes `online_stock` and the POS passes `pos_stock`.
- **Done when:**
  - The popup caps the amount by `buy_limit` (0 = no limit) and by stock.
  - A sold-out variant can't be added.
  - A test covers the cap.

### 1.2 Cart
- **Size:** S · **Depends on:** F4 · **Owner:** FE1 · **shared**
- **Files:** `packages/ui/src/useCart.ts`, `packages/shared/src/cart.ts`
- **Done when:** `useCart` adds, changes and removes lines, and `cartSubtotal()` has a test.

### 1.3 Page: Shop list
- **Size:** S · **Depends on:** 1.1, 1.2 · **Owner:** FE1
- **Read:** POC page 1, screen A
- **Files:** `apps/client/src/app/page.tsx`
- **Done when:** it shows one section per shop with only `visible_to_online` variants, and the cart ticket at the bottom.

### 1.4 Page: Checkout
- **Size:** S · **Depends on:** 1.3 · **Owner:** FE1
- **Read:** POC page 1, screen C
- **Files:** `apps/client/src/app/checkout/page.tsx`
- **Do:** items, shipping, total and steps ①–③. Step ① is a plain form in sprint 1 (no Google sign-in, no lookup).
- **Done when:** Back returns to the shop list with the cart unchanged.

### 1.5 Checkout: payment and order
- **Size:** S · **Depends on:** 1.4, 1.6, 1.7, S5 · **Owner:** FE1
- **Read:** FRONTEND.md "Rules every app follows", "Copy"
- **Files:** `apps/client/src/app/checkout/`
- **Do:**
  - Show `PaymentQR` with the total from `POST /quote`.
  - "Upload slip" reads the slip's QR. If it can't be read, the order can't be placed (D5).
  - "Place order" calls `POST /orders`, then shows the success popup.
- **Done when:** duplicate slip, out of stock and unreadable QR each show their message from FRONTEND.md "Copy".

### 1.6 PromptPay QR
- **Size:** M · **Depends on:** F8 · **Owner:** FE3 · **shared**
- **Files:** `packages/shared/src/promptpay.ts`, `packages/ui/src/PaymentQR.tsx`
- **Done when:** the payload builder has a test, and a Thai banking app scans the QR and shows the right amount.

### 1.7 Slip QR reader
- **Size:** M · **Depends on:** F1 · **Owner:** FE3 · **shared**
- **Files:** `packages/ui/src/slipQr.ts`
- **Do:** read the QR from an uploaded image (client) and from camera frames (POS). Return the payload string, or null.
- **Done when:** it reads real slips from at least two Thai banks.

### 1.8 Dashboard: sign-in and layout
- **Size:** S · **Depends on:** F2, F6 · **Owner:** FE2
- **Read:** FRONTEND.md "apps/dashboard"; POC page 3
- **Files:** `apps/dashboard/src/app/`
- **Done when:** a wrong token shows an error, the right one opens the sidebar (Dashboard, Products, Orders, POS), and Dashboard shows its empty state.

### 1.9 Dashboard: Products page
- **Size:** M · **Depends on:** 1.8, S2 · **Owner:** FE2
- **Read:** POC page 3, Products
- **Files:** `apps/dashboard/src/app/products/`
- **Done when:** an admin can create a shop, a product with two variants, and add stock. Images are URL inputs.

---

## Sprint 2: buyer details, back office, POS

### 2.1 Checkout: Google sign-in
- **Size:** S · **Depends on:** 1.4, S6, I6 · **Owner:** FE1
- **Files:** `apps/client/src/app/checkout/`
- **Done when:** step ② can't be reached without signing in, the form is filled from `GET /me`, and the email field is read-only.

### 2.2 Postcode lookup endpoint
- **Size:** M · **Depends on:** F3 · **Owner:** FE1 (BE reviews)
- **Files:** `apps/server/src/routes/address.ts`, `src/services/postcode.ts`
- **Do:** choose the source: a free external API, otherwise a bundled dataset. `GET /address/postcode/:code` returns `[{ tambon, amphoe, province }]`.
- **Done when:** a postcode that covers several tambons returns all of them.

### 2.3 Checkout: details form
- **Size:** M · **Depends on:** 2.1, 2.2, 2.4 · **Owner:** FE1
- **Read:** POC page 1, "Address lookup"
- **Done when:**
  - The form has first name, last name, nickname, phone, LINE ID and email.
  - Postcode → tambon dropdown → amphoe and province fill in.
  - A missing tambon or a bad phone number blocks Next.
  - The address preview uses `formatThaiAddress()`.

### 2.4 Thai address format
- **Size:** S · **Depends on:** F4 · **Owner:** FE1 · **shared**
- **Files:** `packages/shared/src/address.ts`
- **Done when:** a test covers a Bangkok address (แขวง/เขต) and a non-Bangkok one (ตำบล/อำเภอ).

### 2.5 Emails
- **Size:** S · **Depends on:** F3, 2.4, I6 · **Owner:** FE3 (BE reviews)
- **Read:** BACKEND.md "Emails"
- **Files:** `apps/server/src/services/email.ts`
- **Done when:** the order confirmation (items, total, address) and the shipping update (tracking ID) both arrive in a real inbox. A failed send is logged and never fails the order.

### 2.6 POS: sell screen
- **Size:** M · **Depends on:** 1.1, 1.2, F7, S8 · **Owner:** FE3
- **Read:** POC page 2, screen 1
- **Files:** `apps/pos/src/app/`
- **Done when:** portrait shows the rotate prompt, the POS location is remembered on the device, and products show with `pos_stock`.

### 2.7 POS: pay screen
- **Size:** M · **Depends on:** 2.6, 1.6, 1.7, S9 · **Owner:** FE3
- **Read:** POC page 2, screen 2
- **Done when:** both the camera scan and "Manual verify" save a sale and return to an empty sell screen.

### 2.8 Dashboard: Orders page
- **Size:** M · **Depends on:** 1.8, S7, 2.4 · **Owner:** FE2
- **Read:** POC page 3, Orders
- **Done when:** the list shows the new-order badge, the detail shows buyer and address, and saving a tracking ID changes the status to SHIPPING.

### 2.9 Dashboard: POS page
- **Size:** M · **Depends on:** 1.9, S8 · **Owner:** FE2
- **Read:** POC page 3, POS
- **Done when:** an admin can create a POS (one or more shops), transfer stock to it, and end the sale, which empties its stock table.

### 2.10 CEO walkthrough
- **Size:** S · **Depends on:** 2.8, 2.9 · **Owner:** FE2
- **Done when:** the walkthrough is done and the feedback is written down.

---

## Across both sprints

### X1. Device check
- **Size:** S per sprint · **Owner:** FE1 (client on phones), FE3 (POS on the real tablets)
- **Done when:** every page from that sprint works at 360px wide, and the POS camera works on the devices TCOS will use.

### X2. Accessibility check
- **Size:** S per sprint · **Owner:** each FE for their app
- **Read:** FRONTEND.md "Quality floor"
- **Done when:** every image has `alt`, every control works with the keyboard, reduced motion stops the ticket flash, and text contrast passes.

### X3. Switch to the real API
- **Size:** S per page · **Depends on:** the page's endpoint
- **Done when:** the page renders from the real API with the fixture flag off.

---

## Server

### S1. Models and indexes
- **Size:** S · **Sprint:** 1 · **Depends on:** F3, F4, D1 · **Owner:** BE · **shared**
- **Read:** BACKEND.md "Data model"
- **Done when:** the models load (including `users`, with the draft schema), and `slip_qr_data` and `users.email` have unique indexes.

### S2. Admin catalog API
- **Size:** M · **Sprint:** 1 · **Depends on:** S1, F6 · **Owner:** BE
- **Read:** BACKEND.md "API"
- **Done when:** shops, products and variants have CRUD, and adding stock uses an atomic `$inc`. Each route has a test.

### S3. Public catalog
- **Size:** S · **Sprint:** 1 · **Depends on:** S2 · **Owner:** BE
- **Done when:** `GET /catalog` returns only `visible_to_online` variants, each with a `sold_out` flag.

### S4. Pricing and quote
- **Size:** S · **Sprint:** 1 · **Depends on:** S1 · **Owner:** BE · **shared** (`services/pricing.ts`)
- **Read:** BACKEND.md "Business rules" 1
- **Done when:** `POST /quote` returns subtotal, shipping and total from database prices, and a test shows client-sent prices are ignored.

### S5. Create order
- **Size:** M · **Sprint:** 1 · **Depends on:** S4 · **Owner:** BE
- **Read:** BACKEND.md "Business rules"
- **Done when:** tests cover:
  - a duplicate slip returns `409 DUPLICATE_SLIP`;
  - two orders for the last item: only one succeeds;
  - `buy_limit` is enforced;
  - an order without `slip_qr_data` is rejected (D5).

### S6. Google sign-in
- **Size:** M · **Sprint:** 2 · **Depends on:** S1, I6 · **Owner:** BE
- **Read:** BACKEND.md "Auth details"
- **Do:**
  - `POST /auth/google` verifies the ID token and sets the session cookie. Check that `google-auth-library` runs on Workers.
  - With no user for that email, create one in the merch `users` collection with the email and the name from Google (D4). Fields the merch site doesn't collect stay empty.
  - Placing an order saves the buyer's details (name, nickname, phone, LINE ID, address) to their user, so the next sign-in autofills them.
  - `GET /me` returns the autofill fields. `POST /orders` requires the session.
- **Done when:** an expired or forged token is rejected, a first sign-in gives an empty form apart from the name and email, and a second sign-in gives the details from the last order.

### S7. Admin orders
- **Size:** S · **Sprint:** 2 · **Depends on:** S5 · **Owner:** BE
- **Done when:** orders can be listed by status and counted, and `PATCH /admin/orders/:id/tracking` sets status `SHIPPING`. A POS sale can't get a tracking ID.

### S8. POS management API
- **Size:** M · **Sprint:** 2 · **Depends on:** S2 · **Owner:** BE
- **Done when:** a POS can be created, stock transferred to it, and its sale ended. A test shows total stock (online plus every POS) never changes.

### S9. POS sales
- **Size:** S · **Sprint:** 2 · **Depends on:** S8, S4 · **Owner:** BE
- **Done when:** the same tests as S5 pass against `pos_stock`, and "Manual verify" saves `verify_method: MANUAL` with no `slip_qr_data`.

### S10. Email calls
- **Size:** S · **Sprint:** 2 · **Depends on:** 2.5, S7 · **Owner:** BE
- **Done when:** the confirmation is sent once per order, and the shipping update once per tracking save.

### S11. Seed
- **Size:** S · **Sprint:** 2 · **Depends on:** S2 · **Owner:** BE
- **Done when:** one command loads the current TCOS products for demos.

---

## Infrastructure

### I1. Repo rules and current apps
- **Size:** S · **Sprint:** 1 · **Owner:** DO
- **Do:**
  - Commit `apps/client`, `apps/pos` and `apps/server`, the `api/` removal and the dashboard upgrade.
  - Protect `main`: pull requests with a review.
- **Done when:** a fresh clone has all four apps, and nobody can push straight to `main`.

### I2. Atlas
- **Size:** S · **Sprint:** 1 · **Owner:** DO
- **Do:**
  - Create a new Atlas project with a free (M0) cluster and the merch database (`TODO(names)`), under the TCOS account.
  - Create a database user for `apps/server` with read and write on the merch database only.
  - A second database (or cluster) for tests and staging, so tests never touch real orders.
  - Network access for Workers. Workers don't have fixed outgoing IPs, so check what Atlas needs to allow them.
  - Check that M0's limits suit the server (for example the number of connections from Workers).
- **Done when:** F3's health route reads from the new cluster.

### I3. CI
- **Size:** S · **Sprint:** 2 · **Depends on:** F1 · **Owner:** DO
- **Done when:** on every pull request, install, lint, type check, tests and the build of all four apps run (`TODO(CI platform)`), and a failure blocks the merge.

### I4. Cloudflare: client and server
- **Size:** S · **Sprint:** 1 · **Depends on:** F3 · **Owner:** DO
- **Do:** set the secrets with `npx wrangler secret put`, deploy `apps/server` and `apps/client` to a staging environment, choose the Workers plan (`TODO(Workers plan)`).
- **Done when:** the sprint 1 demo runs on staging.

### I5. VM: dashboard and POS
- **Size:** M · **Sprint:** 2 · **Depends on:** F7 · **Owner:** DO
- **Do:**
  - Run `apps/dashboard` and `apps/pos` under `pm2`, restarting on reboot.
  - Reachable only over Tailscale.
  - HTTPS for the POS: browsers only allow the camera on HTTPS (or localhost).
  - The POS's `ADMIN_ACCESS_TOKEN` in its env on the VM.
- **Done when:** a tablet on Tailscale opens the POS and its camera; a device off Tailscale can't reach either app.

### I6. External accounts and domains
- **Size:** S · **Sprint:** 1 · **Owner:** DO
- **Do:**
  - Google OAuth client in the TCOS Google Cloud project, with local, staging and production origins (D3).
  - Resend with the sending domain verified.
  - Domains for the client and the server under one parent domain (`TODO(domains)`). The session cookie is only sent when both share it.
- **Done when:** FE1 can sign in with Google on staging, and Resend sends from the real domain.

### I7. Backups, logs, uptime
- **Size:** S · **Sprint:** 2 · **Owner:** DO
- **Done when:**
  - The merch database is backed up and one restore into a scratch database has worked. Check what M0 offers for backups; otherwise a scheduled `mongodump`.
  - Logs from the server can be searched.
  - An uptime check on `/health` alerts DO.

### I8. Cutover plan
- **Size:** S · **Sprint:** 2 · **Owner:** DO
- **Done when:** a plan in `docs/` covers when the Google Form stops taking orders, who watches the first day, and how to roll back. The CEO has agreed to it.

### I9. Production release
- **Size:** S · **Sprint:** 2 · **Depends on:** all · **Owner:** DO
- **Done when:** one real order and one POS sale go through in production.

---

## Load

Rough days per person (S = 1, M = 2.5), against 5 working days per sprint:

| Owner | Sprint 1 | Sprint 2 | Total (of 10) |
|---|---|---|---|
| DO | F1, F2, F3, F6, I1, I2, I4, I6 ≈ 9.5 | F7, I3, I5, I7, I8, I9 ≈ 7.5 | ≈ 17 |
| BE | S1, S2, S3, S4, S5 ≈ 8 | S6, S7, S8, S9, S10, S11 ≈ 9 | ≈ 17 |
| FE1 | 1.1–1.5 ≈ 6.5 | 2.1–2.4 ≈ 7 | ≈ 13.5 |
| FE2 | F4, F5, 1.8, 1.9 ≈ 7 | 2.8, 2.9, 2.10 ≈ 6 | ≈ 13 |
| FE3 | F8, 1.6, 1.7 ≈ 6 | 2.5, 2.6, 2.7 ≈ 6 | ≈ 12 |

**By these sizes, the work is about 72 days against 50 available.** DO and BE are the most overloaded. Options:

1. **Add a third sprint**, as the portfolio project has.
2. **Cut, in this order, until it fits:** emails (2.5, S10), the postcode lookup (2.2; use plain address fields), CI (I3; check builds by hand), the dashboard POS page (2.9; transfer stock from the Products page only).
3. **Move work to FE3, who has the most room:** for example F6 or S11.

**Critical path:** I1 → F1 → F3 → S1 → S4 → S5 → 1.5 (sprint 1 demo), then S8 → S9 → 2.7 (POS).

## Out of scope (marked in the POC)
Sales dashboard, promotions, shipping-fee setting, tracking provider and link, cash at POS, order statuses beyond `ORDERED` / `SHIPPING` / `ARRIVED`.
