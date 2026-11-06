// Placeholder data for development. Not real TCOS products or prices.
import type { Shop } from "../schemas/shop";

export const SHOP_MAIN_ID = "64a000000000000000000001";
export const SHOP_STAGE_ID = "64a000000000000000000002";

export const fixtureShops: Shop[] = [
  {
    _id: SHOP_MAIN_ID,
    shop_name: "Placeholder Shop A",
    archived: false,
  },
  {
    _id: SHOP_STAGE_ID,
    shop_name: "Placeholder Shop B",
    archived: false,
  },
];
