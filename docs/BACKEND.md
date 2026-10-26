# BACKEND

`apps/server`: Node + Express + Mongoose + TypeScript, on the private server. Serves `apps/client`, `apps/pos` and `apps/dashboard` over REST. Tasks are in [TASKS.md](TASKS.md).

## Stack
| Concern | Choice |
|---|---|
| HTTP | Express |
| Database | MongoDB via Mongoose |
| Validation and types | zod schemas in `packages/shared`, reused by all apps |
| Buyer auth | Google ID token verified on the server (`google-auth-library`), then an httpOnly session cookie |
| Admin auth | `Authorization: Bearer <ADMIN_ACCESS_TOKEN>` |
| Email | Resend |
| Tests | vitest (already in apps/server) against a separate test database (`MONGODB_URI_TEST`) |

## Folder layout
```
apps/server/src/
  index.ts          app setup, CORS, error handler, listen
  env.ts            reads and validates .env with zod (fail fast on start)
  models/           Mongoose models
  routes/           public.ts, auth.ts, orders.ts, admin/*.ts, pos.ts
  services/         pricing.ts (quote), stock.ts, email.ts, postcode.ts
  middleware/       adminAuth.ts, session.ts
```

## Environment (`.env`)
| Key | Used for |
|---|---|
| `MONGODB_URI` | Database (must be a replica set, see transactions below) |
| `ADMIN_ACCESS_TOKEN` | Dashboard (and POS, see D6 in TASKS) |
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
| `users` (existing, enrollment) | Existing fields unchanged. Add `line_id: string \| null` and `address: { details, tambon, amphoe, province, postal_code }`. Never overwrite enrollment fields without the user submitting them. |
| `shops` | `shop_name` |
| `products` | `shop_id`, `name`, `description`, `image: string[]`, `variants: [{ _id, name, price, image, online_stock, buy_limit, visible_to_online }]` |
| `purchases` | `users: ObjectId \| null` (null = POS), `products: [{ products_id, variants: [{ variants_id, count, unit_price }] }]`, `original_price`, `shipping_fee`, `recipient: { first_name, last_name, nickname, phone, line_id, email }`, `shipping_address`, `slip_qr_data: string \| null` (unique, sparse), `verify_method: 'QR' \| 'MANUAL'`, `pos_id: ObjectId \| null`, `tracking_provider`, `tracking_id`, `status: 'ORDERED' \| 'SHIPPING' \| 'ARRIVED'`, `created_at` |
| `pos` | `name`, `shop_ids: ObjectId[]`, `products: [{ product_id, variants: [{ variants_id, pos_stock }] }]`, `stock_log: [{ product_id, variant_id, amount, direction: 'TO_POS' \| 'TO_MAIN', at }]` |

`unit_price` per line is added so a later price change can't alter old orders. `original_price` stays as the order subtotal.

## Business rules (the reason this system exists)
1. **The server decides every amount.** Prices, subtotal and shipping always come from the database (`services/pricing.ts`). Totals sent by a client are ignored. `POST /quote` and `POST /orders` call the same function, so the QR amount equals the charged amount.
2. **Stock can't go negative.** Deduct with a conditional update (`online_stock >= count`) for each variant inside one **transaction**. If any line fails, the whole order fails with `409 OUT_OF_STOCK`. Transactions need a replica set (D2).
3. **One slip pays one order.** `slip_qr_data` has a unique sparse index. A duplicate returns `409 DUPLICATE_SLIP`.
4. **`buy_limit`** (0 = no limit) is checked per order line. Whether it should apply per person is still open.
5. **Stock moves are logged.** Transfer to POS and end-of-sale returns write `stock_log` entries in the same transaction as the stock change.
6. **Orders keep a copy** of recipient and address at order time, so later edits to the user record don't change past orders.

## API

Errors use `{ error: { code, message } }` with codes like `VALIDATION`, `UNAUTHORIZED`, `OUT_OF_STOCK`, `DUPLICATE_SLIP`, `NOT_FOUND`.

| Method & path | Auth | Used by | Task |
|---|---|---|---|
| `GET /health` | – | ops | T01 |
| `GET /catalog` | – | client | T09 |
| `POST /quote` `{ items }` → `{ subtotal, shipping_fee, total, promptpay_id }` | – | client, POS | T19 |
| `POST /auth/google` `{ id_token }` | – | client | T20 |
| `GET /me` → autofill fields | session | client | T20 |
| `GET /address/postcode/:code` | – | client | T22 |
| `POST /orders` | session (from Sprint 2) | client | T17, T20 |
| `GET/POST/PATCH/DELETE /admin/shops[/:id]` | admin | dashboard | T08 |
| `GET/POST/PATCH/DELETE /admin/products[/:id]` | admin | dashboard | T08 |
| `POST/PATCH/DELETE /admin/products/:id/variants[/:vid]` | admin | dashboard | T08 |
| `POST /admin/products/:id/variants/:vid/stock` `{ amount }` | admin | dashboard | T08 |
| `GET /admin/orders?status=&page=` | admin | dashboard | T27 |
| `GET /admin/orders/count?status=ORDERED` | admin | dashboard | T27 |
| `GET /admin/orders/:id` | admin | dashboard | T27 |
| `PATCH /admin/orders/:id/tracking` `{ tracking_id }` | admin | dashboard | T27 |
| `GET/POST /admin/pos`, `GET /admin/pos/:id` | admin | dashboard, POS | T30 |
| `POST /admin/pos/:id/transfer` `{ product_id, variant_id, amount }` | admin | dashboard | T30 |
| `POST /admin/pos/:id/end-sale` | admin | dashboard | T30 |
| `POST /pos/:id/sales` | admin (D6) | POS | T31 |

## Shared zod schemas
`packages/shared/src/schemas/` holds one file per collection (`shop`, `product`, `purchase`, `pos`, `user`) plus request bodies (`QuoteRequest`, `CreateOrderRequest`, `CreatePosSaleRequest`, `TransferRequest`). Express validates each body with them, and the apps import the inferred types. A change to a schema is a change to the API contract, so the FE leads review it.

## Auth details
- **Buyer:** the client sends the Google ID token to `POST /auth/google`. The server verifies the audience (`GOOGLE_CLIENT_ID`) and `email_verified`, looks up `users` by email, and sets an httpOnly, `Secure`, `SameSite=Lax` cookie. The behaviour when no user matches waits on D4.
- **Admin:** constant-time comparison of the bearer token with `ADMIN_ACCESS_TOKEN`. Rotating the token means editing `.env` and restarting.

## Emails (T25, T26)
`services/email.ts` exposes `sendOrderConfirmation(order)` and `sendShippingUpdate(order)`. They are called after the database write succeeds. A failed send is logged and never rolls back the order. The tracking link is not included yet (tracking provider is still open).

## Tests that must exist
- Pricing: client-sent prices ignored; shipping added once per order.
- Orders and POS sales: duplicate slip rejected; two parallel orders for the last item, only one succeeds; `buy_limit` enforced.
- Transfer and end sale: total stock (online + all POS) unchanged.
- Admin routes return 401 without the token.
