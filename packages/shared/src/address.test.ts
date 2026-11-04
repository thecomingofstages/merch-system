import { describe, expect, it } from "vitest";
import { formatThaiAddress } from "./address";

describe("formatThaiAddress", () => {
  it("uses แขวง/เขต and no จังหวัด for Bangkok", () => {
    const address = {
      details: "254 ถนนพญาไท",
      tambon: "วังใหม่",
      amphoe: "ปทุมวัน",
      province: "กรุงเทพมหานคร",
      postal_code: "10330",
    };
    expect(formatThaiAddress(address)).toBe("254 ถนนพญาไท แขวงวังใหม่ เขตปทุมวัน กรุงเทพมหานคร 10330");
  });

  it("uses ตำบล/อำเภอ/จังหวัด outside Bangkok", () => {
    const address = {
      details: "239 ถนนห้วยแก้ว",
      tambon: "สุเทพ",
      amphoe: "เมืองเชียงใหม่",
      province: "เชียงใหม่",
      postal_code: "50200",
    };
    expect(formatThaiAddress(address)).toBe("239 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200");
  });
});
