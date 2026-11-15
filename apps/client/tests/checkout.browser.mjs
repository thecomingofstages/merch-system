// Start the client with NEXT_PUBLIC_USE_FIXTURES=true and open it with playwright-cli.
// Run: playwright-cli run-code "$(sed 's/^export default //' apps/client/tests/checkout.browser.mjs)"
export default async function checkCheckout(page) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(new URL("/checkout", page.url()).href);
  await page.getByText("ยังไม่มีสินค้าในตะกร้า", { exact: true }).waitFor();
  assert(await page.getByRole("button", { name: "Next", exact: true }).count() === 0, "Empty cart must not continue");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /หมวกแก๊ป/ }).click();
  await page.getByRole("button", { name: "ใส่ตะกร้า", exact: true }).click();
  await page.getByRole("button", { name: "ชำระเงิน", exact: true }).click();
  await page.getByRole("term").filter({ hasText: "Shipping" }).waitFor();
  const summary = page.getByRole("region", { name: "Checkout", exact: true });
  assert(await summary.getByText("฿60", { exact: true }).count() === 1, "Show fixture quote shipping");
  assert(await summary.getByText("฿250", { exact: true }).count() === 1, "Show fixture quote total");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No overflow at 360px");

  // Synthetic buyer and address values reused from order.integration.test.ts.
  for (const [label, value] of Object.entries({
    "First name": "A", "Last name": "B", Nickname: "C", Phone: "12345",
    Email: "Buyer@Example.com", "Postal code": "10200", "Tambon/Khwaeng": "T",
    "Amphoe/Khet": "A", Province: "P", Details: "1 Road",
  })) await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await page.getByRole("button", { name: "Next", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.locator('input[name="phone"][aria-invalid="true"]').waitFor();
  assert(await page.getByRole("textbox", { name: "Phone", exact: true }).getAttribute("aria-invalid") === "true", "Bad phone blocks Next");
  assert(await page.getByRole("region", { name: "① Enter details", exact: true }).isVisible(), "Stay on details after validation fails");
  await page.getByRole("textbox", { name: "Phone", exact: true }).fill("0812345678");
  await page.getByRole("button", { name: "Next", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("region", { name: "② Payment", exact: true }).waitFor();
  assert(await page.getByRole("button", { name: "Next", exact: true }).isDisabled(), "Payment stays disabled until task 1.5");
  assert(await page.getByRole("region", { name: "② Payment", exact: true }).getByText("฿250", { exact: true }).count() === 1, "Payment ticket uses the quoted total");
  await page.getByRole("button", { name: "Back", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert(await page.getByRole("textbox", { name: "First name", exact: true }).inputValue() === "A", "Back preserves entered details");
  await page.setViewportSize({ width: 1280, height: 900 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No desktop overflow");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.getByText("ตะกร้า 1", { exact: true }).waitFor();
  assert(await page.getByText("1 ชิ้น", { exact: true }).count() === 1, "Back to shop preserves cart count");
  assert(await page.getByRole("main").getByText("฿190", { exact: true }).count() === 1, "Back to shop preserves product price");
  assert(await page.getByText("1 ชิ้น", { exact: true }).locator("..").getByText("฿190", { exact: true }).count() === 1, "Back to shop preserves cart subtotal");
}
