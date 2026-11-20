// Placeholder data for development. Not real TCOS products or prices.
import type { Promotion } from "../schemas/promotion";
import {
  PRODUCT_KEYCHAIN_ID,
  PRODUCT_SHIRT_ID,
  VARIANT_KEYCHAIN_SINGLE_ID,
  VARIANT_SHIRT_M_ID,
  VARIANT_SHIRT_S_ID,
  VARIANT_SHIRT_XL_SOLDOUT_ID,
} from "./products";

export const PROMOTION_SET_ID = "64e000000000000000000001";
export const PROMOTION_INACTIVE_ID = "64e000000000000000000002";

export const fixturePromotions: Promotion[] = [
  {
    // Across two shops, sizes can be mixed, and one allowed variant is sold out.
    _id: PROMOTION_SET_ID,
    name: "Placeholder set",
    description: "Placeholder: any 2 shirts (sizes can be mixed) and 1 keychain bag.",
    image: null,
    price: 599,
    active: true,
    archived: false,
    items: [
      { product_id: PRODUCT_SHIRT_ID, variant_ids: [VARIANT_SHIRT_S_ID, VARIANT_SHIRT_M_ID, VARIANT_SHIRT_XL_SOLDOUT_ID], count: 2 },
      { product_id: PRODUCT_KEYCHAIN_ID, variant_ids: [VARIANT_KEYCHAIN_SINGLE_ID], count: 1 },
    ],
  },
  {
    // Switched off: never in the catalog.
    _id: PROMOTION_INACTIVE_ID,
    name: "Placeholder set (off)",
    description: "",
    image: null,
    price: 100,
    active: false,
    archived: false,
    items: [{ product_id: PRODUCT_SHIRT_ID, variant_ids: [VARIANT_SHIRT_S_ID], count: 1 }],
  },
];
