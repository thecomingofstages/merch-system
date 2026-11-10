// pm2 on the private VM (I5): `npm ci && npm run build -w apps/dashboard -w apps/pos`, then
// `pm2 start ecosystem.config.cjs`. NEXT_PUBLIC_* values are read at build time from each
// app's .env.production.local, so rebuild after changing them.
const path = require("node:path");

// Run Next.js's own bin with node, not `npm start`: pm2 cluster mode can only fork a node script.
const next = path.join(__dirname, "node_modules/next/dist/bin/next");

module.exports = {
  apps: [
    {
      name: "merch-dashboard",
      cwd: path.join(__dirname, "apps/dashboard"),
      script: next,
      args: "start -p 3001",
      env: { NODE_ENV: "production" },
    },
    {
      name: "merch-pos",
      cwd: path.join(__dirname, "apps/pos"),
      script: next,
      args: "start -p 3002",
      // Cluster mode: the instances share port 3002. Add more with `pm2 scale merch-pos <n>`.
      exec_mode: "cluster",
      instances: 1,
      env: { NODE_ENV: "production" },
    },
  ],
};
