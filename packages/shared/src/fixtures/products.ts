// Placeholder data for development. Not real TCOS products or prices.
import type { Product } from "../schemas/product";
import { SHOP_MAIN_ID, SHOP_STAGE_ID } from "./shops";

// TODO(placeholder image host): decide where placeholder images live.
export const PLACEHOLDER_IMAGE = "https://example.invalid/placeholder-merch.png";

export const PRODUCT_SHIRT_ID = "64b000000000000000000001";
export const PRODUCT_CAP_ID = "64b000000000000000000002";
export const PRODUCT_KEYCHAIN_ID = "64b000000000000000000003";
export const PRODUCT_STICKER_ID = "64b000000000000000000004";
export const PRODUCT_ARCHIVED_ID = "64b000000000000000000005";

export const VARIANT_SHIRT_S_ID = "64c000000000000000000001";
export const VARIANT_SHIRT_M_ID = "64c000000000000000000002";
export const VARIANT_SHIRT_XL_SOLDOUT_ID = "64c000000000000000000003";
export const VARIANT_CAP_RED_LIMIT_ID = "64c000000000000000000004";
export const VARIANT_CAP_ONSITE_HIDDEN_ID = "64c000000000000000000005";
export const VARIANT_KEYCHAIN_SINGLE_ID = "64c000000000000000000006";
export const VARIANT_KEYCHAIN_ARCHIVED_ID = "64c000000000000000000007";
export const VARIANT_STICKER_SET_ID = "64c000000000000000000008";
export const VARIANT_ARCHIVED_PROD_ID = "64c000000000000000000009";

export const fixtureProducts: Product[] = [
  {
    _id: PRODUCT_SHIRT_ID,
    shop_id: SHOP_MAIN_ID,
    // Thai text name & price differs between variants.
    name: "เสื้อยืดที่ระลึก (ตัวอย่าง)",
    description: "Placeholder shirt with size variants at different prices.",
    image: [PLACEHOLDER_IMAGE],
    archived: false,
    variants: [
      {
        _id: VARIANT_SHIRT_S_ID,
        name: "S",
        price: 250,
        image: PLACEHOLDER_IMAGE,
        online_stock: 15,
        buy_limit: 0,
        visible_to_online: true,
        archived: false,
      },
      {
        _id: VARIANT_SHIRT_M_ID,
        name: "M",
        price: 290,
        image: PLACEHOLDER_IMAGE,
        online_stock: 10,
        buy_limit: 0,
        visible_to_online: true,
        archived: false,
      },
      {
        // Sold-out variant (online_stock: 0).
        _id: VARIANT_SHIRT_XL_SOLDOUT_ID,
        name: "XL",
        price: 320,
        image: PLACEHOLDER_IMAGE,
        online_stock: 0,
        buy_limit: 0,
        visible_to_online: true,
        archived: false,
      },
    ],
  },
  {
    _id: PRODUCT_CAP_ID,
    shop_id: SHOP_MAIN_ID,
    name: "หมวกแก๊ป (ตัวอย่าง)",
    description: "Placeholder cap with buy_limit and an on-site-only hidden variant.",
    image: [PLACEHOLDER_IMAGE],
    archived: false,
    variants: [
      {
        // Variant with buy_limit > 0.
        _id: VARIANT_CAP_RED_LIMIT_ID,
        name: "สีแดง",
        price: 190,
        image: PLACEHOLDER_IMAGE,
        online_stock: 8,
        buy_limit: 2,
        visible_to_online: true,
        archived: false,
      },
      {
        // Hidden variant (visible_to_online: false).
        _id: VARIANT_CAP_ONSITE_HIDDEN_ID,
        name: "สีดำ (หน้างาน)",
        price: 190,
        image: PLACEHOLDER_IMAGE,
        online_stock: 12,
        buy_limit: 0,
        visible_to_online: false,
        archived: false,
      },
    ],
  },
  {
    _id: PRODUCT_KEYCHAIN_ID,
    shop_id: SHOP_STAGE_ID,
    // Long product name to test layout wrapping.
    name: "พวงกุญแจสุ่มลายคอลเลกชันพิเศษสำหรับทดสอบการแสดงผลชื่อสินค้าที่ยาวมากบนหน้าจอมือถือ (ตัวอย่าง)",
    description: "Placeholder keychain with an active variant and an archived variant.",
    image: [PLACEHOLDER_IMAGE],
    archived: false,
    variants: [
      {
        _id: VARIANT_KEYCHAIN_SINGLE_ID,
        name: "ซองสุ่ม 1 ชิ้น",
        price: 119,
        image: PLACEHOLDER_IMAGE,
        online_stock: 25,
        buy_limit: 5,
        visible_to_online: true,
        archived: false,
      },
      {
        // Archived variant (archived: true).
        _id: VARIANT_KEYCHAIN_ARCHIVED_ID,
        name: "รุ่นเก่า (เลิกจำหน่าย)",
        price: 99,
        image: null,
        online_stock: 0,
        buy_limit: 0,
        visible_to_online: true,
        archived: true,
      },
    ],
  },
  {
    _id: PRODUCT_STICKER_ID,
    shop_id: SHOP_STAGE_ID,
    name: "สติกเกอร์เซ็ต (ตัวอย่าง)",
    description: "Placeholder sticker pack.",
    image: [PLACEHOLDER_IMAGE],
    archived: false,
    variants: [
      {
        _id: VARIANT_STICKER_SET_ID,
        name: "ลายรวม",
        price: 29,
        image: PLACEHOLDER_IMAGE,
        online_stock: 40,
        buy_limit: 0,
        visible_to_online: true,
        archived: false,
      },
    ],
  },
  {
    // Archived product (archived: true).
    _id: PRODUCT_ARCHIVED_ID,
    shop_id: SHOP_STAGE_ID,
    name: "สินค้าเก่าที่ถูกเก็บเข้าคลัง (ตัวอย่าง)",
    description: "Placeholder archived product hidden from public catalog.",
    image: [PLACEHOLDER_IMAGE],
    archived: true,
    variants: [
      {
        _id: VARIANT_ARCHIVED_PROD_ID,
        name: "มาตรฐาน",
        price: 150,
        image: PLACEHOLDER_IMAGE,
        online_stock: 0,
        buy_limit: 0,
        visible_to_online: true,
        archived: true,
      },
    ],
  },
];
