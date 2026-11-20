// Placeholder data for development. Not real TCOS orders or buyer records.
import type { Purchase } from "../schemas/purchase";
import { FAKE_SHIPPING_FEE } from "./catalog";
import {
  PRODUCT_CAP_ID,
  PRODUCT_KEYCHAIN_ID,
  PRODUCT_SHIRT_ID,
  PRODUCT_STICKER_ID,
  VARIANT_CAP_ONSITE_HIDDEN_ID,
  VARIANT_CAP_RED_LIMIT_ID,
  VARIANT_KEYCHAIN_SINGLE_ID,
  VARIANT_SHIRT_M_ID,
  VARIANT_SHIRT_S_ID,
  VARIANT_STICKER_SET_ID,
} from "./products";

export const ORDER_PENDING_BANGKOK_ID = "64d000000000000000000001";
export const ORDER_VERIFIED_PROVINCE_ID = "64d000000000000000000002";
export const ORDER_SHIPPING_LONG_ID = "64d000000000000000000003";
export const ORDER_REJECTED_ID = "64d000000000000000000004";
export const ORDER_POS_MANUAL_ID = "64d000000000000000000005";

export const FIXTURE_USER_1_ID = "64e000000000000000000001";
export const FIXTURE_USER_2_ID = "64e000000000000000000002";
export const FIXTURE_USER_3_ID = "64e000000000000000000003";
export const FIXTURE_USER_4_ID = "64e000000000000000000004";
export const FIXTURE_POS_1_ID = "64f000000000000000000001";

/**
 * Sorted newest first (created_at descending) to match GET /admin/orders.
 */
export const fixtureOrders: Purchase[] = [
  {
    // 1. Online order: PENDING_CHECK, ORDERED, multiple products & variants, Bangkok address (แขวง/เขต).
    _id: ORDER_PENDING_BANGKOK_ID,
    users: FIXTURE_USER_1_ID,
    products: [
      {
        products_id: PRODUCT_SHIRT_ID,
        product_name: "เสื้อยืดที่ระลึก (ตัวอย่าง)",
        variants: [
          {
            variants_id: VARIANT_SHIRT_S_ID,
            variant_name: "S",
            count: 1,
            unit_price: 250,
          },
          {
            variants_id: VARIANT_SHIRT_M_ID,
            variant_name: "M",
            count: 2,
            unit_price: 290,
          },
        ],
      },
      {
        products_id: PRODUCT_CAP_ID,
        product_name: "หมวกแก๊ป (ตัวอย่าง)",
        variants: [
          {
            variants_id: VARIANT_CAP_RED_LIMIT_ID,
            variant_name: "สีแดง",
            count: 1,
            unit_price: 190,
          },
        ],
      },
    ],
    promotions: [],
    original_price: 1020,
    shipping_fee: FAKE_SHIPPING_FEE,
    recipient: {
      first_name: "พิมพ์ชนก",
      last_name: "วงศ์สวัสดิ์",
      nickname: "พิม",
      phone: "0812345678",
      line_id: "pim_stage_demo",
      email: "pim.demo@example.com",
    },
    shipping_address: {
      details: "99/12 อาคารตัวอย่าง ชั้น 4 ถนนพญาไท",
      tambon: "วังใหม่",
      amphoe: "ปทุมวัน",
      province: "กรุงเทพมหานคร",
      postal_code: "10330",
    },
    slip_qr_data: "FAKE-SLIP-REF-20261118-0001-KBANK-1080",
    verify_method: "QR",
    payment_status: "PENDING_CHECK",
    verified_at: null,
    pos_id: null,
    tracking_provider: null,
    tracking_id: null,
    status: "ORDERED",
    created_at: "2026-11-18T10:30:00.000Z",
  },
  {
    // 2. Online order: VERIFIED and not shipped yet (status: ORDERED), non-Bangkok address (ตำบล/อำเภอ/จังหวัด), line_id: null.
    _id: ORDER_VERIFIED_PROVINCE_ID,
    users: FIXTURE_USER_2_ID,
    products: [
      {
        products_id: PRODUCT_KEYCHAIN_ID,
        product_name:
          "พวงกุญแจสุ่มลายคอลเลกชันพิเศษสำหรับทดสอบการแสดงผลชื่อสินค้าที่ยาวมากบนหน้าจอมือถือ (ตัวอย่าง)",
        variants: [
          {
            variants_id: VARIANT_KEYCHAIN_SINGLE_ID,
            variant_name: "ซองสุ่ม 1 ชิ้น",
            count: 2,
            unit_price: 119,
          },
        ],
      },
    ],
    promotions: [],
    original_price: 238,
    shipping_fee: FAKE_SHIPPING_FEE,
    recipient: {
      first_name: "ธนกฤต",
      last_name: "เจริญสุข",
      nickname: "ต้น",
      phone: "0898765432",
      line_id: null,
      email: "ton.demo@example.com",
    },
    shipping_address: {
      details: "239 ถนนห้วยแก้ว หมู่บ้านตัวอย่าง",
      tambon: "สุเทพ",
      amphoe: "เมืองเชียงใหม่",
      province: "เชียงใหม่",
      postal_code: "50200",
    },
    slip_qr_data: "FAKE-SLIP-REF-20261117-0002-SCB-0298",
    verify_method: "QR",
    payment_status: "VERIFIED",
    verified_at: "2026-11-17T15:10:00.000Z",
    pos_id: null,
    tracking_provider: null,
    tracking_id: null,
    status: "ORDERED",
    created_at: "2026-11-17T14:45:00.000Z",
  },
  {
    // 3. Online order: VERIFIED and SHIPPING with a tracking_id, long Thai name and long address for wrapping check.
    _id: ORDER_SHIPPING_LONG_ID,
    users: FIXTURE_USER_3_ID,
    products: [
      {
        products_id: PRODUCT_STICKER_ID,
        product_name: "สติกเกอร์เซ็ต (ตัวอย่าง)",
        variants: [
          {
            variants_id: VARIANT_STICKER_SET_ID,
            variant_name: "ลายรวม",
            count: 3,
            unit_price: 29,
          },
        ],
      },
    ],
    promotions: [],
    original_price: 87,
    shipping_fee: FAKE_SHIPPING_FEE,
    recipient: {
      first_name: "ณัฐกานต์ศิริประภา",
      last_name: "อัครเดชากุลพิพัฒน์ธนโชติ",
      nickname: "ลูกพีช",
      phone: "0823456789",
      line_id: "peach_longname_demo",
      email: "peach.demo@example.com",
    },
    shipping_address: {
      details:
        "123/456 หมู่ที่ 8 หมู่บ้านโครงการตัวอย่างเฟส 3 ซอยสุขุมวิท 101/1 แยก 24 อาคารชุดพักอาศัยตึก B ชั้น 12 ห้อง 1209",
      tambon: "บางจาก",
      amphoe: "พระโขนง",
      province: "กรุงเทพมหานคร",
      postal_code: "10260",
    },
    slip_qr_data: "FAKE-SLIP-REF-20261116-0003-BBL-0147",
    verify_method: "QR",
    payment_status: "VERIFIED",
    verified_at: "2026-11-16T09:20:00.000Z",
    pos_id: null,
    tracking_provider: null,
    tracking_id: "TH01999888777A",
    status: "SHIPPING",
    created_at: "2026-11-16T08:00:00.000Z",
  },
  {
    // 4. Online order: REJECTED (only returned by listOrders when payment_status=REJECTED).
    _id: ORDER_REJECTED_ID,
    users: FIXTURE_USER_4_ID,
    products: [
      {
        products_id: PRODUCT_SHIRT_ID,
        product_name: "เสื้อยืดที่ระลึก (ตัวอย่าง)",
        variants: [
          {
            variants_id: VARIANT_SHIRT_S_ID,
            variant_name: "S",
            count: 1,
            unit_price: 250,
          },
        ],
      },
    ],
    promotions: [],
    original_price: 250,
    shipping_fee: FAKE_SHIPPING_FEE,
    recipient: {
      first_name: "กิตติพงศ์",
      last_name: "สายชล",
      nickname: "กิต",
      phone: "0861112233",
      line_id: null,
      email: "kit.demo@example.com",
    },
    shipping_address: {
      details: "45/1 ถนนมิตรภาพ",
      tambon: "ในเมือง",
      amphoe: "เมืองขอนแก่น",
      province: "ขอนแก่น",
      postal_code: "40000",
    },
    slip_qr_data: "FAKE-SLIP-REF-20261115-0004-KTB-0310",
    verify_method: "QR",
    payment_status: "REJECTED",
    verified_at: null,
    pos_id: null,
    tracking_provider: null,
    tracking_id: null,
    status: "ORDERED",
    created_at: "2026-11-15T12:00:00.000Z",
  },
  {
    // 5. POS sale: users null, pos_id set, verify_method MANUAL, no slip_qr_data key, no recipient or address.
    _id: ORDER_POS_MANUAL_ID,
    users: null,
    products: [
      {
        products_id: PRODUCT_CAP_ID,
        product_name: "หมวกแก๊ป (ตัวอย่าง)",
        variants: [
          {
            variants_id: VARIANT_CAP_ONSITE_HIDDEN_ID,
            variant_name: "สีดำ (หน้างาน)",
            count: 1,
            unit_price: 190,
          },
        ],
      },
    ],
    promotions: [],
    original_price: 190,
    shipping_fee: 0,
    recipient: null,
    shipping_address: null,
    verify_method: "MANUAL",
    payment_status: "VERIFIED",
    verified_at: "2026-11-14T18:00:00.000Z",
    pos_id: FIXTURE_POS_1_ID,
    tracking_provider: null,
    tracking_id: null,
    status: "ARRIVED",
    created_at: "2026-11-14T18:00:00.000Z",
  },
];
