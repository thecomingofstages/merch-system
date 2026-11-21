// Promotion sets (D13) against the fixtures, at 360px: open the set, mix variants, add it, check out.
// By hand: start the client with NEXT_PUBLIC_USE_FIXTURES=true and open it with playwright-cli.
// Run: playwright-cli run-code "$(sed 's/^export default //' apps/client/tests/promotions.browser.mjs)"
export default async function checkPromotions(page) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  // Keyboard instead of click: the dev overlay's badge covers the bottom-left button at 360px.
  const press = async (locator) => { await locator.focus(); await page.keyboard.press("Enter"); };

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(new URL("/", page.url()).href);
  const heading = page.getByRole("heading", { name: "โปรโมชัน", exact: true });
  await heading.waitFor();
  const main = page.getByRole("main");
  assert(
    await main.evaluate((el, h) => el.querySelector("h2") === h, await heading.elementHandle()),
    "Promotions come first, above the shops",
  );
  assert(await page.getByText("Placeholder set (off)").count() === 0, "A set switched off isn't shown");

  await press(page.getByRole("button", { name: /Placeholder set/ }));
  const dialog = page.getByRole("dialog", { name: "Placeholder set" });
  await dialog.waitFor();
  const add = dialog.getByRole("button", { name: "ใส่ตะกร้า", exact: true });
  assert(await add.isDisabled(), "Nothing picked: can't add");
  assert(await dialog.getByRole("button", { name: "เพิ่ม XL", exact: true }).isDisabled(), "A sold-out variant can't be picked");

  // Mix sizes for the 2 shirts, then the bag.
  await press(dialog.getByRole("button", { name: "เพิ่ม S", exact: true }));
  await press(dialog.getByRole("button", { name: "เพิ่ม M", exact: true }));
  assert(await dialog.getByRole("button", { name: "เพิ่ม S", exact: true }).isDisabled(), "An item can't take more than its count");
  assert(await add.isDisabled(), "The bag is still missing");
  await press(dialog.getByRole("button", { name: /^เพิ่ม ซองสุ่ม/ }));
  await press(add);

  await page.getByRole("link", { name: "ตะกร้า 3 ชิ้น", exact: true }).waitFor();
  assert(await page.locator('[aria-live="polite"]', { hasText: "ตะกร้า 3 ชิ้น" }).count() === 1, "The new count is announced");

  // Set pieces use up stock for single lines too: M has 10, the set took 1, so 9 single M at most.
  await press(page.getByRole("button", { name: /เสื้อยืด/ }));
  const product = page.getByRole("dialog", { name: /เสื้อยืด/ });
  await product.getByRole("combobox").selectOption({ label: "M · ฿290" });
  const more = product.getByRole("button", { name: "เพิ่มจำนวน", exact: true });
  for (let i = 0; i < 20 && !(await more.isDisabled()); i++) await press(more);
  assert(await product.locator("output").textContent() === "9", "Single M is capped by the stock left after the set");
  await page.keyboard.press("Escape");
  await press(page.getByRole("button", { name: "ชำระเงิน", exact: true }));
  const summary = page.getByRole("region", { name: "สรุปคำสั่งซื้อ", exact: true });
  await summary.getByText("Placeholder set", { exact: true }).waitFor();
  await summary.getByText("฿659", { exact: true }).waitFor(); // 599 + 60 shipping, from the quote
  assert(await summary.getByText("฿599", { exact: true }).count() === 1, "The set shows its own price");
  assert(await summary.getByText(/\(S\) ×1/).count() === 1 && await summary.getByText(/\(M\) ×1/).count() === 1, "The picks are listed");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No overflow at 360px");
}
