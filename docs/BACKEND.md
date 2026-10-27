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
From the draft schema plus the additions on POC page 4. Open decision D1 (embedded vs separate products) changes `products`; the layout below assumes the recommended separate collection.

| Collection | Fields |
|---|---|
| `users` | The draft schema (the enrollment site's fields), in the merch database. A user is created on first Google sign-in; fields the merch site doesn't collect stay empty. Add `line_id: string \| null` and `address: { details, tambon, amphoe, province, postal_code }`. Only the buyer's own submissions change these fields. |
| `shops` | `shop_name` |
| `products` | `shop_id`, `name`, `description`, `image: string[]`, `variants: [{ _id, name, price, image, online_stock, buy_limit, visible_to_online }]` |
| `purchases` | `users: ObjectId \| null` (null = POS), `products: [{ products_id, variants: [{ variants_id, count, unit_price }] }]`, `original_price`, `shipping_fee`, `recipient: { first_name, last_name, nickname, phone, line_id, email }`, `shipping_address`, `slip_qr_data: string \| null` (unique, sparse), `verify_method: 'QR' \| 'MANUAL'`, `pos_id: ObjectId \| null`, `tracking_provider`, `tracking_id`, `status: 'ORDERED' \| 'SHIPPING' \| 'ARRIVED'`, `created_at` |
| `pos` | `name`, `shop_ids: ObjectId[]`, `products: [{ product_id, variants: [{ variants_id, pos_stock }] }]`, `stock_log: [{ product_id, variant_id, amount, direction: 'TO_POS' \| 'TO_MAIN', at }]` |

`unit_price` per line is added so a later price change can't alter old orders. `original_price` stays as the order subtotal.

## Business rules (the reason this system exists)
1. **The server decides every amount.** Prices, subtotal and shipping always come from the database (`helpers/pricing.helper.ts`). Totals sent by a client are ignored. `POST /quote` and `POST /orders` call the same function, so the QR amount equals the charged amount.
2. **Stock can't go negative.** Deduct with a conditional update (`online_stock >= count`) for each variant inside one **transaction**. If any line fails, the whole order fails with `409 OUT_OF_STOCK`. Transactions need a replica set (D2).
3. **One slip pays one order.** `slip_qr_data` has a unique sparse index. A duplicate returns `409 DUPLICATE_SLIP`.
4. **Every online order needs `slip_qr_data`** (D5). Thai bank slips all carry a QR code, so an order whose QR couldn't be read is rejected.
5. **`buy_limit`** (0 = no limit) is checked per order line. Whether it should apply per person is still open.
6. **Stock moves are logged.** Transfer to POS and end-of-sale returns write `stock_log` entries in the same transaction as the stock change.
7. **Orders keep a copy** of recipient and address at order time, so later edits to the user record don't change past orders.

## API

Errors use `{ error: { code, message } }` with codes like `VALIDATION`, `UNAUTHORIZED`, `OUT_OF_STOCK`, `DUPLICATE_SLIP`, `NOT_FOUND`.

| Method & path | Auth | Used by | Task |
|---|---|---|---|
| `GET /health` | – | ops | F3 |
| `GET /catalog` | – | client | S3 |
| `POST /quote` `{ items }` → `{ subtotal, shipping_fee, total, promptpay_id }` | – | client, POS | S4 |
| `POST /auth/google` `{ id_token }` | – | client | S6 |
| `GET /me` → autofill fields | session | client | S6 |
| `GET /address/postcode/:code` | – | client | 2.2 |
| `POST /orders` | session (from Sprint 2) | client | S5, S6 |
| `GET/POST/PATCH/DELETE /admin/shops[/:id]` | admin | dashboard | S2 |
| `GET/POST/PATCH/DELETE /admin/products[/:id]` | admin | dashboard | S2 |
| `POST/PATCH/DELETE /admin/products/:id/variants[/:vid]` | admin | dashboard | S2 |
| `POST /admin/products/:id/variants/:vid/stock` `{ amount }` | admin | dashboard | S2 |
| `GET /admin/orders?status=&page=` | admin | dashboard | S7 |
| `GET /admin/orders/count?status=ORDERED` | admin | dashboard | S7 |
| `GET /admin/orders/:id` | admin | dashboard | S7 |
| `PATCH /admin/orders/:id/tracking` `{ tracking_id }` | admin | dashboard | S7 |
| `GET/POST /admin/pos`, `GET /admin/pos/:id` | admin | dashboard, POS | S8 |
| `POST /admin/pos/:id/transfer` `{ product_id, variant_id, amount }` | admin | dashboard | S8 |
| `POST /admin/pos/:id/end-sale` | admin | dashboard | S8 |
| `POST /pos/:id/sales` | admin (D6) | POS | S9 |

## Shared zod schemas
`packages/shared/src/schemas/` holds one file per collection (`shop`, `product`, `purchase`, `pos`, `user`) plus request bodies (`QuoteRequest`, `CreateOrderRequest`, `CreatePosSaleRequest`, `TransferRequest`). Express validates each body with them, and the apps import the inferred types. FE2 writes the first version (F4) and BE reviews it. After that, a change to a schema is a change to the API contract, so BE and the FE leads review it.

## Auth details
- **Buyer:** the client sends the Google ID token to `POST /auth/google`. The server verifies the audience (`GOOGLE_CLIENT_ID`) and `email_verified`, looks up `users` by email, and sets an httpOnly, `Secure`, `SameSite=Lax` cookie. With no user for that email, the server creates one with the email and name from Google (D4). Placing an order saves the buyer's details to their user, so the next sign-in autofills them. The client and the server must be on one parent domain, or the cookie isn't sent (see Hosting).
- **Admin:** constant-time comparison of the bearer token with `ADMIN_ACCESS_TOKEN`. Rotating it means `npx wrangler secret put` on the server and updating the POS's env on the VM.
- **Dashboard:** the admin types the token on the sign-in screen.
- **POS (D6):** `ADMIN_ACCESS_TOKEN` is set in the POS's env on the VM. The POS browser calls the POS's own Next.js server, which adds the token and forwards the call (F7). The token never reaches the tablet's browser. Because the POS uses the admin token, anyone with access to the POS VM has full admin access; Tailscale is what limits that.

## Emails (2.5, S10)
`helpers/email.helper.ts` exposes `sendOrderConfirmation(order)` and `sendShippingUpdate(order)`. They are called after the database write succeeds. A failed send is logged and never rolls back the order. The tracking link is not included yet (tracking provider is still open).

## Tests that must exist
- Pricing: client-sent prices ignored; shipping added once per order.
- Orders and POS sales: duplicate slip rejected; two parallel orders for the last item, only one succeeds; `buy_limit` enforced.
- Transfer and end sale: total stock (online + all POS) unchanged.
- Admin routes return 401 without the token.
