// Runs checkout.browser.mjs against a fixtures build of the client, as CI does:
//   NEXT_PUBLIC_USE_FIXTURES=true npm run build -w apps/client && npm run test:browser -w apps/client
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import checkCheckout from "./checkout.browser.mjs";

const url = "http://localhost:3100";
const server = spawn("npx", ["next", "start", "-p", "3100"], { stdio: "inherit" });

try {
  for (let tries = 0; ; tries++) {
    if (await fetch(url).then((res) => res.ok, () => false)) break;
    if (tries > 120) throw new Error(`next start did not answer on ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(url);
    await checkCheckout(page);
    console.log("checkout.browser.mjs: passed");
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
