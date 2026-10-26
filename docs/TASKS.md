# TASKS: 2-sprint work breakdown

Team: **DO** (DevOps / infrastructure, project lead), **BE** (backend), **FE1** (client + shared UI), **FE2** (dashboard), **FE3** (POS + payments + emails).
Two sprints of 1 week each. Scope = the [POC](poc/merch-poc.drawio) minus everything marked "to be implemented" or "ask CEO".

Details: [BACKEND.md](BACKEND.md), [FRONTEND.md](FRONTEND.md).

## Sprint goals

| Sprint | Goal | Demo |
|---|---|---|
| **1** | One online purchase works end to end (no Google sign-in, no emails yet) | Admin adds a product in the dashboard. A buyer orders it on the client with a plain details form, pays the QR, uploads the slip. The order is in the database and stock went down. |
| **2** | Buyer details, back office, POS, emails | Google sign-in with autofill, postcode lookup, confirmation email. Admin enters tracking (shipping email sent). A POS sells transferred stock with camera scan or manual verify, then returns stock at end of sale. |

## Before day 1 (blocking)

| # | Decision | Owner | Blocks |
|---|---|---|---|
| D1 | Products: embedded in `shops.shop_products` **or** a separate `products` collection with `shop_id`? The draft schema has both. (Recommended: separate collection.) | BE | T04 |
| D2 | MongoDB host. Multi-item orders need a **transaction**, which needs a replica set (Atlas has one; a self-hosted standalone `mongod` does not). Must reach the existing enrollment `users` data. | DO | T04, T17, T41 |
| D3 | Google Cloud project owner and OAuth client ID (Web). | DO | T20, T21, T45 |
| D8 | Where `apps/client` and `apps/pos` are deployed: the private server, or Cloudflare (client and dashboard already have OpenNext/wrangler config). The dashboard and server go on the private server. | DO | T43, T36 |
| D9 | CI platform and how the server is run (e.g. Docker or a process manager). | DO | T42, T43 |
| D4 | No enrollment user matches the Google email: create a new user, or don't link one? | DO + CEO | T20 |
| D5 | Slip QR can't be read from an uploaded image on the client: block submit, or save the order for staff to check? | DO | T18 |
| D6 | How does the POS app authenticate? (Assumed below: the same `ADMIN_ACCESS_TOKEN` as the dashboard.) | DO | T31, T33 |
| D7 | New dependencies to approve: QR rendering, QR decoding, `google-auth-library`, `resend`, `mongoose`, `express`. | DO | T15, T16, T20, T25 |

## Task list

Legend: **Shared** = lives in `packages/ui` or `packages/shared` and is used by more than one app.

### EPIC E0: Foundation

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T01 | Convert `apps/server` from a Cloudflare Worker to Node + Express + TypeScript. Remove wrangler. Add `.env` loading and `GET /health`. | BE | 1 | – | `npm run dev` in apps/server serves `/health` |
| T02 | Root npm workspace with `apps/*` and `packages/*`. Create empty `packages/ui` and `packages/shared`. All three Next apps import from both. | FE1 | 1 | – | `npm install` at root works; each app builds and renders one component from `packages/ui` |
| T03 | **Shared** zod schemas and types in `packages/shared` for every collection and API request/response ([BACKEND.md](BACKEND.md#shared-zod-schemas)). | BE | 1 | T02 | FEs can import the types; FE leads have reviewed them |
| T04 | Mongoose models and indexes (unique sparse `slip_qr_data`, `users.email`). Read the existing enrollment `users` collection without breaking it. | BE | 1 | T01, D1, D2 | Models load against the dev database |
| T05 | Admin auth middleware (`Authorization: Bearer ADMIN_ACCESS_TOKEN`) and CORS for the three app origins. | BE | 1 | T01 | Admin routes return 401 without the token |
| T06 | Dashboard: token sign-in screen, API fetch helper that sends the token, sidebar layout (Dashboard, Products, Orders, POS). Dashboard page left empty. | FE2 | 1 | T02 | Wrong token shows an error; the right one opens the layout |
| T07 | **Shared** base components in `packages/ui`: Button, Input, Select, Dialog, QuantityStepper, Price (฿ formatting), design tokens. | FE3 | 1 | T02 | Used by at least one app |

### EPIC E1: Catalog and stock

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T08 | Admin API: CRUD shops, products, variants. `POST …/variants/:id/stock` adds stock with an atomic `$inc`. | BE | 1 | T03, T04, T05 | All endpoints have a request test |
| T09 | Public catalog API: shops with products and only `visible_to_online` variants, including a `sold_out` flag. | BE | 1 | T08 | Client can render the shop list from it |
| T10 | Dashboard Products page: shops, products and variants CRUD; "Add stock" dialog. Images are URL inputs (no upload). | FE2 | 1 | T06, T08 | Admin can create a shop with a product and two variants and add stock |

### EPIC E2: Storefront and cart

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T11 | **Shared** `ProductCard`, `ProductPopup`, `CartSummary` (props only, no data fetching, so the POS can pass `pos_stock`). | FE1 | 1 | T07 | Rendered in client and in a POS test page |
| T12 | **Shared** cart: `useCart` hook in `packages/ui`, and `cartSubtotal()` in `packages/shared` with a unit test. | FE1 | 1 | T03 | Test covers quantity caps (`buy_limit`, stock) and totals |
| T13 | Client shop list page: header with Cart, shop sections, tray with message + Checkout. | FE1 | 1 | T09, T11, T12 | Matches the POC page 1 screen A |
| T14 | Client checkout page: items, shipping (fixed constant for now), total, steps ①–③. Step ① is a **plain form** in Sprint 1 (no Google, no lookup). | FE1 | 1 | T13 | Back returns to the shop list with the cart intact |

### EPIC E4: Payment and orders

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T15 | **Shared** PromptPay payload builder (amount set, CRC) in `packages/shared` with a test; `PaymentQR` component in `packages/ui`. | FE3 | 1 | T07, D7 | Test vectors pass; a banking app scans the QR and shows the right amount |
| T16 | **Shared** slip QR reader in `packages/ui`: from an uploaded image (client) and from camera frames (POS). Returns the payload string or null. | FE3 | 1 | T02, D7 | Reads real slips from at least 2 Thai banks |
| T19 | `POST /quote`: the server computes subtotal + shipping for a cart, so the QR amount always equals what the server will charge. | BE | 1 | T09 | Client and POS show the quoted total |
| T17 | `POST /orders` (online): validate, **recompute prices from the database**, check `buy_limit`, deduct `online_stock` in one transaction, save recipient/address copy, `slip_qr_data`, `verify_method`, `created_at`, status `ORDERED`. Reject a duplicate slip. | BE | 1 | T04, T19, D2 | Tests: duplicate slip rejected; last item can't be sold twice; client-sent prices ignored |
| T18 | Client payment step: `PaymentQR` with the quoted total, Upload slip → read QR, Submit → `POST /orders`, success popup → Home. Errors for duplicate slip, out of stock, unreadable QR (per D5). | FE1 | 1 | T14, T15, T16, T17 | Sprint 1 demo passes |

### EPIC E3: Buyer details

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T20 | `POST /auth/google`: verify the Google ID token, look up the enrollment user by email, set an httpOnly session cookie. `GET /me` returns autofill fields. `POST /orders` requires the session. | BE | 2 | T17, D3, D4 | Expired or forged token is rejected |
| T21 | Client: Google sign-in button (Google Identity Services), required before step ①; autofill from `/me`; email read-only. | FE1 | 2 | T20 | Can't reach step ② without signing in |
| T22 | Postcode lookup: pick the source (free API, otherwise a bundled dataset); `GET /address/postcode/:code` in apps/server returns `[{ tambon, amphoe, province }]`. (FE-owned server task, BE reviews.) | FE1 | 2 | T01 | Postcode with several tambons returns all of them |
| T23 | Client details form: first/last name, nickname, phone, LINE ID, email; postcode → tambon dropdown → amphoe/province; details field; validation with the shared zod schema; address preview. | FE1 | 2 | T21, T22, T24 | Invalid phone or missing tambon blocks Next |
| T24 | **Shared** `formatThaiAddress()` in `packages/shared` (Bangkok: แขวง/เขต; others: ตำบล/อำเภอ) with a test. Used by client preview, dashboard and emails. | FE1 | 2 | T03 | Test covers a Bangkok and a non-Bangkok address |

### EPIC E5: Emails

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T25 | Resend in apps/server: `sendOrderConfirmation(order)` (items, total, address) and `sendShippingUpdate(order)` (tracking ID). A failed email is logged and never fails the order. (FE-owned server task, BE reviews.) | FE3 | 2 | T01, T24, D7 | Both emails arrive in a real inbox |
| T26 | Call `sendOrderConfirmation` after an order is created, and `sendShippingUpdate` after tracking is saved. | BE | 2 | T25, T27 | Emails sent once per event |

### EPIC E6: Orders back office

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T27 | Admin orders API: list (filter by status, paginated), detail, count of new orders, `PATCH /admin/orders/:id/tracking` → status `SHIPPING`. | BE | 2 | T17 | Tracking can't be set on a POS sale |
| T28 | Dashboard Orders page: list with the badge count, detail (items, totals, buyer, formatted address, slip QR data), "Submit for shipping" form. | FE2 | 2 | T27, T24 | Saving tracking updates the list status |

### EPIC E7: POS

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T30 | Admin POS API: create/list/get POS (`name`, `shop_ids`); transfer `online_stock` → `pos_stock` (reject if not enough) with a log entry; end sale returns all `pos_stock` to `online_stock` with log entries. | BE | 2 | T04, T08 | Stock total (online + all POS) never changes during transfers |
| T31 | `POST /pos/:id/sales`: validate, recompute prices, deduct `pos_stock` in one transaction, `users = null`, `pos_id`, `slip_qr_data` or `verify_method = MANUAL`. Reject a duplicate slip. | BE | 2 | T30, T19, D6 | Same tests as T17, against `pos_stock` |
| T32 | Dashboard POS page: create POS (multi-select shops), list, detail stock table, Transfer to POS dialog (also on the variant row in Products), End sale with confirmation. | FE2 | 2 | T30, T10 | End sale empties the POS stock table |
| T33 | POS app screen 1: landscape prompt, POS location select, product grid with `ProductCard`/`ProductPopup` using `pos_stock`, `CartSummary`, Checkout. | FE3 | 2 | T11, T12, T30 | Matches POC page 2 screen 1 |
| T34 | POS app screen 2: `PaymentQR`, camera scan via the T16 reader, Back, Manual verify (confirm dialog), submit sale, reset for the next sale. | FE3 | 2 | T33, T15, T16, T31 | Scan and manual paths both save a sale |

### EPIC E8: Release

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T35 | Seed script with the current TCOS products for demos. | BE | 2 | T08 | One command loads the seed |
| T36 | Production release: deploy the final builds of all four apps through T43's pipeline, run the seed or real data, smoke-test the full purchase and POS flows. | DO | 2 | T43, T44, all apps | Reachable from a phone on mobile data; one real order and one POS sale go through |
| T37 | Device testing: client on phones, POS camera scan on the real tablets/phones. | FE1, FE3 | 2 | T23, T34 | Bug list triaged |
| T38 | CEO walkthrough script and demo run. | FE2 | 2 | T28, T32 | Walkthrough done, feedback logged |

### EPIC E9: Infrastructure (DevOps)

| ID | Task | Owner | Sprint | Depends on | Done when |
|---|---|---|---|---|---|
| T40 | Repo rules: protected `main`, branch naming, PR template, required review. Commit the current staged restructure (`dashboard/` → `apps/`, removed `api/`). | DO | 1 | – | Nobody can push straight to `main` |
| T41 | MongoDB: provision a **replica set** for dev and production (D2), create app users with least privilege, confirm read access to the enrollment `users` data. Local dev: a one-command single-node replica set (e.g. Docker Compose) documented in the README. | DO | 1 | D2 | BE runs a transaction locally and against dev |
| T42 | CI on every PR: install at the workspace root, lint, typecheck, run tests (server + `packages/shared`), build all four apps. | DO | 1 | T02, D9 | A failing test blocks the PR |
| T43 | Environments and deploy pipeline: a **staging** environment from Sprint 1 (so the Sprint 1 demo runs on it), then production. Private server: reverse proxy with HTTPS, a process for apps/server and the dashboard, deploys of client/POS per D8. Merge to `main` deploys to staging. | DO | 1 | T01, T41, D8, D9 | Sprint 1 demo is shown on staging, not a laptop |
| T44 | Secrets: `.env` per environment on the server (never in git), `.env.example` in each app, values for `ADMIN_ACCESS_TOKEN`, `SESSION_SECRET`, `MONGODB_URI`, `PROMPTPAY_ID`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `CORS_ORIGINS`. | DO | 1 | T41 | A new dev can run everything from `.env.example` + values from DO |
| T45 | External accounts: Google OAuth client (authorised origins for local, staging, production) (D3); Resend account with the sending domain verified (DNS records); domains/subdomains for each app. | DO | 1 | D3 | FE1 can sign in with Google on staging; Resend sends from the real domain |
| T46 | HTTPS for the POS on staging and production. Browsers only allow the camera on HTTPS (or localhost), so the slip scanner can't be tested without it. | DO | 1 | T43 | Camera opens on a real tablet against staging |
| T47 | Backups and logs: daily MongoDB backup with one test restore; server logs kept and searchable; an uptime check on `/health` that alerts you. | DO | 2 | T41, T43 | A restore into a scratch database succeeds |
| T48 | Production cutover plan: when the Google Form stops taking orders, who watches the first day, how to roll back to the previous release. | DO | 2 | T43 | Written in `docs/` and agreed with the CEO |

## Load per person

| Owner | Sprint 1 | Sprint 2 |
|---|---|---|
| DO | D1–D9 decisions, T40, T41, T42, T43, T44, T45, T46 | T47, T48, T36; reviews PRs |
| BE | T01, T03, T04, T05, T08, T09, T19, T17 | T20, T26, T27, T30, T31, T35 |
| FE1 | T02, T11, T12, T13, T14, T18 | T21, T22, T23, T24, T37 |
| FE2 | T06, T10 | T28, T32, T38 |
| FE3 | T07, T15, T16 | T25, T33, T34, T37 |

- **BE is the bottleneck.** FEs build against the `packages/shared` zod types and local fixtures, so they don't wait for endpoints. Order of BE work in Sprint 1: T01 → T03 → T04 → T05 → T08/T09 → T19 → T17.
- **FE2 has spare capacity in Sprint 1.** Use it to review T03, help test T17, or pick up T24 early.
- **Critical path:** T02 → T03 → T04 → T17 → T18 (Sprint 1 demo), then T30 → T31 → T34 (POS).
- **DO's first two days matter most.** D2 + T41 (database) unblock BE's T04; D3 + T45 (Google) unblock FE1's Sprint 2 work; T43 + T46 (staging with HTTPS) are needed for the Sprint 1 demo and for camera testing.

## Out of scope (marked in the POC)
Sales dashboard, promotions, shipping-fee setting, tracking provider and link, cash at POS, order statuses beyond `ORDERED` / `SHIPPING` / `ARRIVED`.
