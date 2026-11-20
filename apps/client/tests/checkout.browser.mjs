// Start the client with NEXT_PUBLIC_USE_FIXTURES=true and open it with playwright-cli.
// Run: playwright-cli run-code "$(sed 's/^export default //' apps/client/tests/checkout.browser.mjs)"
export default async function checkCheckout(page) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const box = (name) => page.getByRole("textbox", { name, exact: true });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const step = (name) => page.getByRole("region", { name, exact: true });
  // Keyboard instead of click: the dev overlay's badge covers the bottom-left button at 360px.
  const press = async (locator) => { await locator.focus(); await page.keyboard.press("Enter"); };
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const addCapAndCheckout = async () => {
    await page.getByRole("button", { name: /หมวกแก๊ป/ }).click();
    await press(button("ใส่ตะกร้า"));
    await press(button("ชำระเงิน"));
    await page.getByRole("term").filter({ hasText: "Shipping" }).waitFor();
  };
  // Synthetic buyer values reused from order.integration.test.ts; the places are the client's postcode fixture.
  const fillDetails = async (phone) => {
    for (const [label, value] of Object.entries({
      "First name": "A", "Last name": "B", Nickname: "C", Phone: phone, "Postal code": "10200", Details: "1 Road",
    })) await box(label).fill(value);
  };
  const upload = (buffer) => page.getByLabel("Upload slip").setInputFiles({ name: "slip.png", mimeType: "image/png", buffer });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(new URL("/checkout", page.url()).href);
  await page.getByText("ยังไม่มีสินค้าในตะกร้า", { exact: true }).waitFor();
  assert(await button("Next").count() === 0, "Empty cart must not continue");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await addCapAndCheckout();
  const summary = page.getByRole("region", { name: "Checkout", exact: true });
  assert(await summary.getByText("฿60", { exact: true }).count() === 1, "Show fixture quote shipping");
  assert(await summary.getByText("฿250", { exact: true }).count() === 1, "Show fixture quote total");
  assert(await noOverflow(), "No overflow at 360px");

  // 2.1: no details form (so no step ②) before signing in; the email then comes from Google, read-only.
  assert(await box("First name").count() === 0, "Details need a sign-in first");
  await press(button("Sign in with Google"));
  await box("First name").waitFor();
  assert(await box("Email").inputValue() === "buyer@example.com", "Email comes from the sign-in");
  assert(await box("Email").getAttribute("readonly") !== null, "Email is read-only");

  // 2.3: a bad phone and a missing tambon both block Next.
  await fillDetails("12345");
  const tambon = page.getByRole("combobox", { name: "Tambon/Khwaeng", exact: true });
  await tambon.locator("option", { hasText: "Tambon 2" }).waitFor({ state: "attached" });
  await press(button("Next"));
  await page.locator('input[name="phone"][aria-invalid="true"]').waitFor();
  assert(await tambon.getAttribute("aria-invalid") === "true", "Missing tambon blocks Next");
  assert(await step("① Enter details").isVisible(), "Stay on details after validation fails");
  await box("Phone").fill("0812345678");
  await tambon.selectOption({ label: "Tambon 2" });
  assert(await box("Amphoe/Khet").inputValue() === "Amphoe 1", "Amphoe fills from the tambon");
  assert(await box("Province").inputValue() === "Province 1", "Province fills from the tambon");
  await page.getByText("1 Road ตำบลTambon 2 อำเภอAmphoe 1 จังหวัดProvince 1 10200", { exact: true }).waitFor();
  await press(button("Next"));

  // 1.5: the QR carries the quoted total; Next waits for a slip whose QR was read (D5).
  await step("② Payment").waitFor();
  assert(await step("② Payment").getByText("฿250", { exact: true }).count() >= 1, "Payment uses the quoted total");
  const next = step("② Payment").getByRole("button", { name: "Next", exact: true });
  assert(await next.isDisabled(), "No slip, no Next");
  await upload(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
  await page.getByText("อ่าน QR จากสลิปไม่ได้ ลองอัปโหลดรูปที่ชัดขึ้น", { exact: true }).waitFor();
  assert(await next.isDisabled(), "An unreadable slip blocks the order");
  // A stand-in slip: the page's own QR drawn as a PNG.
  const slip = Buffer.from(await page.evaluate(async () => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(document.querySelector("svg[role=img]")))}`;
    await image.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: 480, height: 480 });
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 480, 480);
    ctx.drawImage(image, 0, 0, 480, 480);
    return canvas.toDataURL("image/png").split(",")[1];
  }), "base64");
  await upload(slip);
  await page.getByText("Slip read", { exact: true }).waitFor();
  await press(button("Back").first());
  assert(await box("First name").inputValue() === "A", "Back preserves entered details");
  await press(button("Next"));
  await press(next);

  await step("③ Confirm order").waitFor();
  await page.getByText("1 Road ตำบลTambon 2 อำเภอAmphoe 1 จังหวัดProvince 1 10200", { exact: true }).last().waitFor();
  assert(await noOverflow(), "No overflow at 360px on confirm");
  await press(button("สั่งซื้อ"));
  await page.getByRole("dialog", { name: "สั่งซื้อแล้ว" }).waitFor();
  await press(button("Done"));
  await page.getByText("ตะกร้า 0", { exact: true }).waitFor();

  // The same slip can't pay a second order.
  await addCapAndCheckout();
  await fillDetails("0812345678");
  await tambon.selectOption({ label: "Tambon 1" });
  await press(button("Next"));
  await upload(slip);
  await press(next);
  await press(button("สั่งซื้อ"));
  await page.getByText("สลิปนี้ใช้กับคำสั่งซื้ออื่นแล้ว กรุณาอัปโหลดสลิปของคำสั่งซื้อนี้", { exact: true }).waitFor();
  assert(await step("② Payment").isVisible(), "A duplicate slip goes back to payment");
  assert(await next.isDisabled(), "A duplicate slip must be replaced");

  await page.setViewportSize({ width: 1280, height: 900 });
  assert(await noOverflow(), "No desktop overflow");
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.getByText("ตะกร้า 1", { exact: true }).waitFor();
  assert(await page.getByText("1 ชิ้น", { exact: true }).locator("..").getByText("฿190", { exact: true }).count() === 1, "Back to shop preserves the cart");
}
