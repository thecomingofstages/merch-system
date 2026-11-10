# merch-system

The merchandise system of The Coming of Stages (TCOS, เด็กไทยติดเวที): an online shop, an on-site POS and a back office, with one API.

Before working on the code, read [AGENTS.md](AGENTS.md). It has the rules and links to the plans in [docs/](docs/).

## Requirements

- **Node.js 22 or later**, with npm (Node 22 is what CI uses).
- **Git**.
- **To run the server against a database:** a MongoDB connection string from the project lead.
- **To deploy only:** a Cloudflare account, signed in with `npx wrangler login`.

## Set up

```bash
npm install
cp apps/client/.env.example apps/client/.env.local
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

Fill in the values the project lead gives you. Never commit `.env.local` or `.dev.vars`.

Then run an app, for example:

```bash
npm run dev -w apps/client
```

The full list of commands is in [AGENTS.md](AGENTS.md) "Commands".

## Run the dashboard and POS on the VM (pm2)

[ecosystem.config.cjs](ecosystem.config.cjs) runs `merch-dashboard` on port 3001 and `merch-pos` on port 3002. Each app's `NEXT_PUBLIC_*` values go in `apps/<app>/.env.production.local` **before** building, because Next.js writes them into the build.

```bash
npm ci
npm run build -w apps/dashboard -w apps/pos
pm2 start ecosystem.config.cjs
pm2 save
```

The POS starts with one instance. Change the count with `pm2 scale merch-pos <n>`, then `pm2 save`. To update: `git pull`, `npm ci`, build again, then `pm2 reload ecosystem.config.cjs`.

## File structure

```
.
├── AGENTS.md            Rules for people and AI tools: read first
├── CLAUDE.md            Points to AGENTS.md
├── docs/                TASKS.md, FRONTEND.md, BACKEND.md, poc/
├── apps/
│   ├── client/          The shop: Next.js on Cloudflare Workers (OpenNext)
│   ├── pos/             On-site sales: Next.js on the private VM
│   ├── dashboard/       Back office: Next.js on the private VM
│   └── server/          API: Express on Cloudflare Workers
└── packages/
    ├── shared/          @merch/shared: zod schemas, types, helpers
    └── ui/              @merch/ui: React components and design tokens
```
