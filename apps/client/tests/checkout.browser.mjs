// Start the client with NEXT_PUBLIC_USE_FIXTURES=true and open it with playwright-cli.
// Run: playwright-cli run-code "$(sed 's/^export default //' apps/client/tests/checkout.browser.mjs)"
export default async function checkCheckout(page) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const box = (name) => page.getByRole("textbox", { name, exact: true });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const step = (name) => page.getByRole("region", { name, exact: true });
  // Keyboard instead of click: the dev overlay's badge covers the bottom-left button at 360px.
  // Waits until enabled: the payment ticket re-renders while a fresh quote loads, and Enter on it then does nothing.
  const press = async (locator) => {
    await page.waitForFunction((el) => !el.disabled, await locator.elementHandle());
    await locator.focus();
    await page.keyboard.press("Enter");
  };
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const addCapAndCheckout = async () => {
    await page.getByRole("button", { name: /หมวกแก๊ป/ }).click();
    await press(button("ใส่ตะกร้า Add to cart"));
    await press(button("ชำระเงิน Checkout"));
    await page.getByRole("term").filter({ hasText: "Shipping" }).waitFor();
  };
  // Synthetic buyer values reused from order.integration.test.ts; the places are the client's postcode fixture.
  const fillDetails = async (phone) => {
    for (const [label, value] of Object.entries({
      "ชื่อ First name": "A", "นามสกุล Last name": "B", "ชื่อเล่น Nickname": "C", "เบอร์โทร Phone": phone,
      "รหัสไปรษณีย์ Postal code": "10200", "บ้านเลขที่ ซอย ถนน House no., soi, road": "1 Road",
    })) await box(label).fill(value);
  };
  const upload = (buffer) => page.getByLabel("อัปโหลดสลิป Upload slip").setInputFiles({ name: "slip.png", mimeType: "image/png", buffer });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(new URL("/checkout", page.url()).href);
  await page.getByText("ยังไม่มีสินค้าในตะกร้า").waitFor();
  assert(await button("ถัดไป Next").count() === 0, "Empty cart must not continue");
  await page.getByRole("link", { name: "กลับ Back", exact: true }).click();
  await addCapAndCheckout();
  const summary = page.getByRole("region", { name: "สรุปคำสั่งซื้อ", exact: true });
  assert(await summary.getByText("฿60", { exact: true }).count() === 1, "Show fixture quote shipping");
  assert(await summary.getByText("฿250", { exact: true }).count() === 1, "Show fixture quote total");
  assert(await noOverflow(), "No overflow at 360px");

  // 2.1: no details form (so no step ②) before signing in; the email then comes from Google, read-only.
  assert(await box("ชื่อ First name").count() === 0, "Details need a sign-in first");
  await press(button("เข้าสู่ระบบด้วย Google Sign in with Google"));
  await box("ชื่อ First name").waitFor();
  assert(await box("อีเมล Email").inputValue() === "buyer@example.com", "Email comes from the sign-in");
  assert(await box("อีเมล Email").getAttribute("readonly") !== null, "Email is read-only");

  // 2.3: a bad phone and a missing tambon both block Next.
  await fillDetails("12345");
  const tambon = page.getByRole("combobox", { name: "ตำบล/แขวง Subdistrict", exact: true });
  await tambon.locator("option", { hasText: "Tambon 2" }).waitFor({ state: "attached" });
  await press(button("ถัดไป Next"));
  await page.locator('input[name="phone"][aria-invalid="true"]').waitFor();
  assert(await tambon.getAttribute("aria-invalid") === "true", "Missing tambon blocks Next");
  assert(await step("① กรอกข้อมูล Your details").isVisible(), "Stay on details after validation fails");
  await box("เบอร์โทร Phone").fill("0812345678");
  await tambon.selectOption({ label: "Tambon 2" });
  assert(await box("อำเภอ/เขต District").inputValue() === "Amphoe 1", "Amphoe fills from the tambon");
  assert(await box("จังหวัด Province").inputValue() === "Province 1", "Province fills from the tambon");
  await page.getByText("1 Road ตำบลTambon 2 อำเภอAmphoe 1 จังหวัดProvince 1 10200", { exact: true }).waitFor();
  await press(button("ถัดไป Next"));

  // 1.5: the QR carries the quoted total; Next waits for a slip whose QR was read (D5).
  await step("② ชำระเงิน Payment").waitFor();
  assert(await step("② ชำระเงิน Payment").getByText("฿250", { exact: true }).count() >= 1, "Payment uses the quoted total");
  const next = step("② ชำระเงิน Payment").getByRole("button", { name: "ถัดไป Next", exact: true });
  assert(await next.isDisabled(), "No slip, no Next");
  await upload(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
  await page.getByText("อ่าน QR จากสลิปไม่ได้ ลองอัปโหลดรูปที่ชัดขึ้น").waitFor();
  assert(await next.isDisabled(), "An unreadable slip blocks the order");
  // The QR comes from promptpay.io (D14) for the quoted total, with the account under it.
  const qr = step("② ชำระเงิน Payment").getByRole("img", { name: "คิวอาร์โค้ดพร้อมเพย์", exact: true });
  const src = await qr.getAttribute("src");
  assert(src === "https://promptpay.io/0000000000000/250.png", `QR for the fixture ID and total, got ${src}`);
  await step("② ชำระเงิน Payment").getByText("บัญชีพร้อมเพย์ PromptPay account: Placeholder account · 0000000000000", { exact: true }).waitFor();
  // A stand-in slip: that QR, fetched outside the page (no CORS) and scaled up like a phone screenshot.
  const png = (await (await page.request.get(src)).body()).toString("base64");
  const slip = Buffer.from(await page.evaluate(async (b64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${b64}`;
    await image.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: 480, height: 480 });
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 480, 480);
    ctx.drawImage(image, 0, 0, 480, 480);
    return canvas.toDataURL("image/png").split(",")[1];
  }, png), "base64");
  await upload(slip);
  await page.getByText("อ่าน QR จากสลิปแล้ว").waitFor();
  await press(button("กลับ Back").first());
  assert(await box("ชื่อ First name").inputValue() === "A", "Back preserves entered details");
  await press(button("ถัดไป Next"));
  await press(next);

  await step("③ ยืนยันคำสั่งซื้อ Confirm order").waitFor();
  await page.getByText("1 Road ตำบลTambon 2 อำเภอAmphoe 1 จังหวัดProvince 1 10200", { exact: true }).last().waitFor();
  assert(await noOverflow(), "No overflow at 360px on confirm");
  await press(button("สั่งซื้อ Place order"));
  await page.getByRole("dialog", { name: "สั่งซื้อแล้ว" }).waitFor();
  await press(button("กลับไปหน้าร้าน Back to the shop"));
  await page.getByRole("link", { name: "ตะกร้า 0 ชิ้น", exact: true }).waitFor();

  // The same slip can't pay a second order.
  await addCapAndCheckout();
  await fillDetails("0812345678");
  await tambon.selectOption({ label: "Tambon 1" });
  await press(button("ถัดไป Next"));
  await upload(slip);
  await press(next);
  await press(button("สั่งซื้อ Place order"));
  await page.getByText("สลิปนี้ใช้กับคำสั่งซื้ออื่นแล้ว กรุณาอัปโหลดสลิปของคำสั่งซื้อนี้").waitFor();
  assert(await step("② ชำระเงิน Payment").isVisible(), "A duplicate slip goes back to payment");
  assert(await next.isDisabled(), "A duplicate slip must be replaced");

  await page.setViewportSize({ width: 1280, height: 900 });
  assert(await noOverflow(), "No desktop overflow");
  await page.getByRole("link", { name: "กลับ Back", exact: true }).click();
  // The basket is in the header on every page, so wait for the shop page and its ticket.
  await page.waitForURL((url) => url.pathname === "/");
  await page.getByRole("link", { name: "ตะกร้า 1 ชิ้น", exact: true }).waitFor();
  await page.getByText("1 ชิ้น", { exact: true }).waitFor();
  assert(await page.getByText("1 ชิ้น", { exact: true }).locator("..").getByText("฿190", { exact: true }).count() === 1, "Back to shop preserves the cart");
}
