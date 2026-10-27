# AGENTS.md

Instructions for AI coding agents (and people) working on the TCOS merch system. Read this file before every task.

## The project

The merchandise system of The Coming of Stages (TCOS, เด็กไทยติดเวที). It replaces the Google Form orders, where buyers added up totals by hand and got them wrong.

| Part | Stack | Runs on |
| --- | --- | --- |
| `apps/client` | Next.js: the public shop | Cloudflare Workers (OpenNext) |
| `apps/pos` | Next.js: on-site sales, tablet, landscape | Private VM, `pm2`, Tailscale only |
| `apps/dashboard` | Next.js: products, orders, POS stock | Private VM, `pm2`, Tailscale only |
| `apps/server` | Express on Cloudflare Workers, Mongoose: the API for all three | Cloudflare Workers |
| `packages/shared` | zod schemas, types, helpers (`@merch/shared`) | used by all apps and the server |
| `packages/ui` | React components, design tokens (`@merch/ui`) | used by the Next.js apps |

## Sources of truth

Read the docs for your task before writing code. When they disagree, stop and ask; do not pick one yourself.

| Question | Source |
| --- | --- |
| Your task: what to read, which files, when it is done | [docs/TASKS.md](docs/TASKS.md) |
| Workspace, shared components, screens, design, copy | [docs/FRONTEND.md](docs/FRONTEND.md) |
| Hosting, database, data model, business rules, API, auth | [docs/BACKEND.md](docs/BACKEND.md) |
| Screen layouts and the proposed schema | [docs/poc/merch-poc.drawio](docs/poc/merch-poc.drawio) (open in diagrams.net) |

## Commands

Run from the repo root (one npm workspace, one lockfile).

| What | Command |
| --- | --- |
| Install | `npm install` |
| Run an app | `npm run dev -w apps/client` (port 3000), `-w apps/dashboard` (3001), `-w apps/pos` (3002), `-w apps/server` (Wrangler, 8787) |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Test | `npm run test` |
| Build an app | `npm run build -w apps/<app>`; client as Cloudflare builds it: `npx opennextjs-cloudflare build` in `apps/client`; server bundle: `npx wrangler deploy --dry-run --outdir dist` in `apps/server` |

CI (`.github/workflows/`) runs lint, type check, tests and the deploy build for each app on every pull request. A type error fails the check.

## Rules

### Content
- **Never invent content.** `TODO(<question>)` in the docs means "not decided yet". Keep it as a `TODO`. Never make up names, numbers, prices or wording, including Thai text.
- Field names are `snake_case`, exactly as in docs/BACKEND.md "Data model".

### Money (the reason this system exists)
- **The server decides every amount.** Totals sent by a browser are ignored. The QR amount comes from `POST /quote`.
- Money is whole baht (`int`).

### Shared code
- Shared components take data as props and never fetch. If behaviour differs between apps, pass it in as a prop.
- Request and response types come from `@merch/shared`; never redefine them in an app.
- Parts marked **shared** in docs/TASKS.md: their owner reviews any change.

### Design
- Use only the tokens in `packages/ui/src/styles.css` (docs/FRONTEND.md "Design direction"). No colour values or font families anywhere else.

### Server (Express on Cloudflare Workers)
- The server runs on Workers, not a long-running Node process. Keep `nodejs_compat` in `wrangler.jsonc`. Do not rely on the disk, on memory kept between requests, or on packages with native add-ons.
- Open the database only through `withDb` in `src/app/database/db.ts` (one connection per request).
- Check request bodies with the zod schemas from `@merch/shared`.
- Every `/admin/*` route needs `Authorization: Bearer <ADMIN_ACCESS_TOKEN>`.

### Secrets
- Never commit `.env*` or `.dev.vars` files, tokens or database URIs. Use `.env.example` (apps) and `.dev.vars.example` (server) with empty values. Server secrets go in with `npx wrangler secret put`.
- Never put a secret in a `NEXT_PUBLIC_` variable. The POS adds `ADMIN_ACCESS_TOKEN` on its own Next.js server, never in the browser.
