# BACKEND

`apps/server`: Express + Mongoose + TypeScript, on Cloudflare Workers. Serves `apps/client`, `apps/pos` and `apps/dashboard` over REST. Tasks are in [TASKS.md](TASKS.md).

## Stack
| Concern | Choice |
|---|---|
| HTTP | Express on Cloudflare Workers (`nodejs_compat`) |
| Database | MongoDB Atlas (new project, free M0 cluster), via Mongoose (if Mongoose doesn't work on Workers, the official `mongodb` driver; F3 checks) |
| Validation and types | zod schemas in `packages/shared`, reused by all apps |
| Buyer auth | Google ID token verified on the server (`google-auth-library`; S6 checks it runs on Workers), then an httpOnly session cookie |
| Admin auth | `Authorization: Bearer <ADMIN_ACCESS_TOKEN>` |
| Email | Resend |
| Tests | vitest with `@cloudflare/vitest-plugin` (already in apps/server) against a separate test database (`MONGODB_URI_TEST`) |

## Hosting
| App | Where | How it runs |
|---|---|---|
| `apps/server` | Cloudflare Workers | `npx wrangler deploy`; secrets with `npx wrangler secret put` |
| `apps/client` | Cloudflare Workers | OpenNext (already configured) |
| `apps/dashboard` | Private VM, Tailscale only | `pm2` |
| `apps/pos` | Private VM, Tailscale only | `pm2`, served over HTTPS (needed for the camera) |

- The client and the server must be on **one parent domain** (for example two subdomains of the same domain). Otherwise the browser won't send the session cookie with the client's requests.
- Workers don't have fixed outgoing IPs, so Atlas network access has to allow them (I2).
- The dashboard and the POS on the VM call the server on Workers over the internet, with `ADMIN_ACCESS_TOKEN`.

## Database
- A **new Atlas project** with a **free (M0) cluster**, separate from the enrollment site. Every Atlas cluster is a replica set, so transactions work.
- The merch server never connects to the enrollment cluster. The merch `users` collection keeps the draft schema and starts empty (D4).
- `apps/server`'s database user: read and write on the merch database only.
- Tests and staging use their own database (`MONGODB_URI_TEST`), never the production one.
- **Collections and indexes are not created by the server.** `withDb` opens a connection per request, so Mongoose's `autoIndex` and `autoCreate` are off. Run `npm run db:sync -w apps/server` once for each database (with its `MONGODB_URI`), and again after any index change. Without it, the unique index on `slip_qr_data` doesn't exist and `DUPLICATE_SLIP` never fires.

## Folder layout
Same layout as the portfolio website's `apps/server`.
```
apps/server/src/
  index.ts              Worker entry point: config → app → listen
  app/
    server.ts           buildApp: Security, routes, NotFound, ErrorHandler
    config/             init.ts reads and checks the environment with zod (fail fast on start);
                        app.conf.ts (vars), app.keys.ts (secrets), db.conf.ts, db.keys.ts
    database/db.ts      the database connection, withDb (F3)
    models/             Mongoose models: <name>.model.ts
    routes/             init.ts mounts them; <name>.route.ts: public, auth, order, address, pos; admin/*.route.ts
    controllers/        <name>.controller.ts: read the request, call a helper, send the answer
    helpers/            business logic: pricing.helper.ts (quote), stock.helper.ts, email.helper.ts, postcode.helper.ts
    middleware/         Security.ts (helmet, CORS, JSON limit), Auth.ts (admin token), Session.ts, ErrorHandler.ts
    utils/              ApiError.ts, config.ts
```
Request bodies are checked with the zod schemas from `@merch/shared` (see "Shared zod schemas"), so there is no `schemas/` folder.

## Environment
Secrets are set with `npx wrangler secret put` in production and in `.dev.vars` locally. `.dev.vars.example` lists every key with empty values.

| Key | Used for |
|---|---|
| `MONGODB_URI` | The merch database on the new cluster |
| `ADMIN_ACCESS_TOKEN` | Dashboard and POS (D6) |
| `PROMPTPAY_ID` | Shared by all shops; sent to the apps that build the QR |
| `GOOGLE_CLIENT_ID` | Verifying ID tokens |
| `SESSION_SECRET` | Signing the session cookie |
| `RESEND_API_KEY`, `EMAIL_FROM` | Emails |
| `CORS_ORIGINS` | Comma-separated origins of the three apps |
| `SHIPPING_FEE` | Flat fee per order for now (shortcut until the per-shop setting is built) |

## Data model
From the draft schema plus the additions on POC page 4. D1 (proposed by BE): a separate `products` collection with variants embedded, so one stock deduction touches one document per product.

| Collection | Fields |
|---|---|
| `users` | The draft schema (the enrollment site's fields), in the merch database, minus `password_hash` (merch only signs in with Google). A user is created on first Google sign-in; fields the merch site doesn't collect stay empty. Add `line_id: string \| null`. `address` is **replaced** by `{ details, tambon, amphoe, province, postal_code }` (the collection starts empty, D4, so nothing to migrate). Only the buyer's own submissions change these fields. |
| `shops` | `shop_name`, `archived` |
| `products` | `shop_id`, `name`, `description`, `image: string[]`, `archived`, `variants: [{ _id, name, price, image, online_stock, buy_limit, visible_to_online, archived }]` |
| `purchases` | `users: ObjectId \| null` (null = POS), `products: [{ products_id, product_name, variants: [{ variants_id, variant_name, count, unit_price }] }]`, `original_price`, `shipping_fee`, `recipient: { first_name, last_name, nickname, phone, line_id, email }`, `shipping_address`, `slip_qr_data?: string` (unique, partial: only string values; **left out**, never `null`, when there is no slip), `verify_method: 'QR' \| 'MANUAL'`, `payment_status: 'PENDING_CHECK' \| 'VERIFIED' \| 'REJECTED'`, `verified_at`, `pos_id: ObjectId \| null`, `tracking_provider`, `tracking_id`, `status: 'ORDERED' \| 'SHIPPING' \| 'ARRIVED'`, `created_at` |
| `pos` | `name`, `shop_ids: ObjectId[]`, `products: [{ product_id, variants: [{ variants_id, pos_stock }] }]`, `stock_log: [{ product_id, variant_id, amount, direction: 'TO_POS' \| 'TO_MAIN', at }]` |

- `unit_price`, `product_name` and `variant_name` per line are copied at order time, so a later price change, rename or archive can't alter old orders. `original_price` stays as the order subtotal.
- **Nothing that orders or stock point at is deleted.** `DELETE` on a shop, product or variant sets `archived: true`, which hides it from the catalog and the POS. It answers `409 IN_USE` while the item still has `online_stock` or any POS holds stock of it.
- **Why the slip index is partial, not sparse:** a sparse index still indexes an explicit `null`, so the second manual POS sale would hit the unique index. The index is `{ unique: true, partialFilterExpression: { slip_qr_data: { $type: "string" } } }`.

## Business rules (the reason this system exists)
1. **The server decides every amount.** Prices, subtotal and shipping always come from the database (`helpers/pricing.helper.ts`). Totals sent by a client are ignored. `POST /quote`, `POST /orders` and `POST /pos/:id/sales` call the same function, so the QR amount equals the charged amount. It takes a channel:
   - `ONLINE`: only `visible_to_online` variants, `online_stock`, plus `SHIPPING_FEE` once per order.
   - `POS` (with `pos_id`): only variants of that POS's `shop_ids`, `pos_stock`, no shipping.
   `POST /orders` always prices as `ONLINE` and `POST /pos/:id/sales` as `POS`; the server sets the channel, never the client.
2. **Lines are merged first.** Lines for the same variant are added together before any check, and `count` must be a positive integer. Otherwise splitting a variant over two lines gets around `buy_limit`.
3. **Stock can't go negative.** Inside `session.withTransaction()` (which retries write conflicts), each line is `updateOne` with `$inc: { "variants.$[v].online_stock": -count }` and `arrayFilters: [{ "v._id": variant_id, "v.online_stock": { $gte: count } }]`. If `modifiedCount !== 1` for any line, the whole order fails with `409 OUT_OF_STOCK`. Check `modifiedCount`, not `matchedCount`: the product still matches when the variant is short. Transactions need a replica set (D2).
4. **One slip pays one order.** `slip_qr_data` has a unique partial index (see "Data model"). A duplicate (E11000 on that index) returns `409 DUPLICATE_SLIP`.
5. **Every online order needs `slip_qr_data`** (D5). Thai bank slips all carry a QR code, so an order whose QR couldn't be read is rejected.
6. **A slip is not proof of payment.** The slip's QR holds the bank and a transaction reference, not the amount or the receiver, so the server can only stop a slip being reused. Every online order starts as `payment_status: PENDING_CHECK`; an admin checks the slip against the bank account and sets `VERIFIED` or `REJECTED`. `REJECTED` returns the stock in a transaction. A tracking ID can only be saved on a `VERIFIED` order. POS sales are `VERIFIED` when saved (staff saw the payment). `TODO(CEO question 21)`: a paid slip-check API could set `VERIFIED` automatically later.
7. **`buy_limit`** (0 = no limit) is checked per order, on the merged lines. Whether it should apply per person is still open.
8. **Stock moves are logged.** Transfer to POS and end-of-sale returns write `stock_log` entries in the same transaction as the stock change.
9. **Orders keep a copy** of recipient and address at order time, so later edits to the user record don't change past orders.

## API

Errors use `{ error: { code, message } }` with codes like `VALIDATION`, `UNAUTHORIZED`, `OUT_OF_STOCK`, `DUPLICATE_SLIP`, `NOT_FOUND`, `IN_USE`, `NOT_VERIFIED`, `BUY_LIMIT`. A malformed id in a path answers `404` like an unknown one.

| Method & path | Auth | Used by | Task |
|---|---|---|---|
| `GET /health` | – | ops | F3 |
| `GET /catalog` → `{ shops: [{ _id, shop_name, products: [{ ..., variants: [{ ..., online_stock, buy_limit, sold_out }] }] }] }` | – | client | S3 |
| `POST /quote` `{ channel, pos_id?, items }` → `{ lines, subtotal, shipping_fee, total, promptpay_id }` | – | client, POS | S4 |
| `POST /auth/google` `{ id_token }` | – | client | S6 |
| `GET /me` → autofill fields | session | client | S6 |
| `GET /address/postcode/:code` | – | client | 2.2 |
| `POST /orders` `{ items, recipient, shipping_address, slip_qr_data }` → `{ _id, status, payment_status, subtotal, shipping_fee, total, created_at }` | session (from Sprint 2) | client | S5, S6 |
| `GET/POST/PATCH/DELETE /admin/shops[/:id]` (`?archived=true` lists archived too) | admin | dashboard | S2 |
| `GET/POST/PATCH/DELETE /admin/products[/:id]` (`?shop_id=`, `?archived=true`) | admin | dashboard | S2 |
| `POST/PATCH/DELETE /admin/products/:id/variants[/:vid]` | admin | dashboard | S2 |
| `POST /admin/products/:id/variants/:vid/stock` `{ amount }`: a non-zero whole number; negative removes stock but never below 0 (`409 OUT_OF_STOCK`) | admin | dashboard | S2 |
| `GET /admin/orders?status=&page=` | admin | dashboard | S7 |
| `GET /admin/orders/count?status=ORDERED` | admin | dashboard | S7 |
| `GET /admin/orders/:id` | admin | dashboard | S7 |
| `PATCH /admin/orders/:id/payment` `{ payment_status: 'VERIFIED' \| 'REJECTED' }` | admin | dashboard | S7 |
| `PATCH /admin/orders/:id/tracking` `{ tracking_id }` (`409 NOT_VERIFIED` unless verified) | admin | dashboard | S7 |
| `GET/POST /admin/pos`, `GET /admin/pos/:id` | admin | dashboard, POS | S8 |
| `POST /admin/pos/:id/transfer` `{ product_id, variant_id, amount }` | admin | dashboard | S8 |
| `POST /admin/pos/:id/end-sale` | admin | dashboard | S8 |
| `POST /pos/:id/sales` | admin (D6) | POS | S9 |

## Shared zod schemas
`packages/shared/src/schemas/` holds one file per collection (`common`, `shop`, `product`, `catalog` and `quote` exist, written by BE with S2–S4; F4 adds the rest) (`shop`, `product`, `purchase`, `pos`, `user`) plus request bodies (`QuoteRequest`, `CreateOrderRequest`, `CreatePosSaleRequest`, `TransferRequest`). Express validates each body with them, and the apps import the inferred types. FE2 writes the first version (F4) and BE reviews it. After that, a change to a schema is a change to the API contract, so BE and the FE leads review it.

## Auth details
- **Buyer:** the client sends the Google ID token to `POST /auth/google`. The server verifies the audience (`GOOGLE_CLIENT_ID`) and `email_verified`, looks up `users` by email, and sets an httpOnly, `Secure`, `SameSite=Lax` cookie. Routes that use the session accept only `Content-Type: application/json` (`415` otherwise) and an `Origin` from `CORS_ORIGINS`: a cross-site form can't send JSON without a CORS preflight, so this closes CSRF. With no user for that email, the server creates one with the email and name from Google (D4). Placing an order saves the buyer's details to their user, so the next sign-in autofills them. The client and the server must be on one parent domain, or the cookie isn't sent (see Hosting).
- **Admin:** constant-time comparison of the bearer token with `ADMIN_ACCESS_TOKEN`. Rotating it means `npx wrangler secret put` on the server and updating the POS's env on the VM.
- **Dashboard:** the admin types the token on the sign-in screen.
- **POS (D6):** `ADMIN_ACCESS_TOKEN` is set in the POS's env on the VM. The POS browser calls the POS's own Next.js server, which adds the token and forwards the call (F7). The token never reaches the tablet's browser. Because the POS uses the admin token, anyone with access to the POS VM has full admin access; Tailscale is what limits that.

## Emails (2.5, S10)
`helpers/email.helper.ts` exposes `sendOrderConfirmation(order)` and `sendShippingUpdate(order)`. They are called after the database write succeeds. A failed send is logged and never rolls back the order. The tracking link is not included yet (tracking provider is still open).

## Tests that must exist
- Pricing: client-sent prices ignored; shipping added once per online order and never on a POS sale.
- Orders and POS sales: duplicate slip rejected; two parallel orders for the last item, only one succeeds (with `409 OUT_OF_STOCK`, not a write-conflict error); `buy_limit` enforced, also when a variant is split over two lines; two manual POS sales in a row both save.
- Payment check: a rejected order returns its stock; tracking can't be saved before `VERIFIED`.
- Archive: archiving an item with stock answers `409 IN_USE`; old orders still show the item's name.
- Transfer and end sale: total stock (online + all POS) unchanged.
- Admin routes return 401 without the token.
- Workers: the Node tests (supertest) don't prove the server runs on Workers. One smoke check against `wrangler dev` runs a transaction (S1) and verifies a Google ID token (S6).
