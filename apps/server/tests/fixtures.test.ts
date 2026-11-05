import { describe, expect, it } from "vitest";
import {
  baht,
  FAKE_SHIPPING_FEE,
  FixtureError,
  fixtureCatalog,
  fixtureProducts,
  fixtureShops,
  mockQuoteForFixtures,
  objectId,
  PRODUCT_ARCHIVED_ID,
  PRODUCT_CAP_ID,
  PRODUCT_SHIRT_ID,
  ProductRequest,
  Shop,
  SHOP_MAIN_ID,
  toCatalog,
  VARIANT_CAP_ONSITE_HIDDEN_ID,
  VARIANT_CAP_RED_LIMIT_ID,
  VARIANT_KEYCHAIN_ARCHIVED_ID,
  VARIANT_SHIRT_S_ID,
  VARIANT_SHIRT_XL_SOLDOUT_ID,
  VariantRequest,
} from "@merch/shared";

describe("fixtures (F5)", () => {
  it("every fixture shop and product parses with its F4 schema", () => {
    expect(fixtureShops.length).toBeGreaterThanOrEqual(2);
    expect(fixtureProducts.length).toBeGreaterThanOrEqual(5);

    for (const shop of fixtureShops) {
      expect(() => Shop.parse(shop)).not.toThrow();
      expect(() => objectId.parse(shop._id)).not.toThrow();
    }

    for (const product of fixtureProducts) {
      expect(() => objectId.parse(product._id)).not.toThrow();
      expect(() =>
        ProductRequest.parse({
          shop_id: product.shop_id,
          name: product.name,
          description: product.description,
          image: product.image,
          variants: product.variants.map((v) => ({
            name: v.name,
            price: v.price,
            image: v.image,
            buy_limit: v.buy_limit,
            visible_to_online: v.visible_to_online,
          })),
        }),
      ).not.toThrow();

      for (const variant of product.variants) {
        expect(() => objectId.parse(variant._id)).not.toThrow();
        expect(() => baht.parse(variant.online_stock)).not.toThrow();
        expect(() =>
          VariantRequest.parse({
            name: variant.name,
            price: variant.price,
            image: variant.image,
            buy_limit: variant.buy_limit,
            visible_to_online: variant.visible_to_online,
          }),
        ).not.toThrow();
      }
    }
  });

  it("includes a sold-out variant, a variant with buy_limit > 0, a hidden variant, and an archived item", () => {
    const allVariants = fixtureProducts.flatMap((p) => p.variants);

    expect(allVariants.some((v) => v.online_stock === 0 && !v.archived)).toBe(true);
    expect(allVariants.some((v) => v.buy_limit > 0)).toBe(true);
    expect(allVariants.some((v) => v.visible_to_online === false)).toBe(true);
    expect(fixtureProducts.some((p) => p.archived) || allVariants.some((v) => v.archived)).toBe(true);
  });

  it("toCatalog excludes hidden variants and archived items, and marks sold_out: true when online_stock === 0", () => {
    const catalog = toCatalog(fixtureShops, fixtureProducts);
    expect(catalog).toEqual(fixtureCatalog);

    const catalogProducts = catalog.shops.flatMap((s) => s.products);
    const catalogVariants = catalogProducts.flatMap((p) => p.variants);

    expect(catalogProducts.map((p) => p._id)).not.toContain(PRODUCT_ARCHIVED_ID);
    expect(catalogVariants.map((v) => v._id)).not.toContain(VARIANT_CAP_ONSITE_HIDDEN_ID);
    expect(catalogVariants.map((v) => v._id)).not.toContain(VARIANT_KEYCHAIN_ARCHIVED_ID);

    const soldOut = catalogVariants.find((v) => v._id === VARIANT_SHIRT_XL_SOLDOUT_ID);
    expect(soldOut).toBeDefined();
    expect(soldOut?.sold_out).toBe(true);

    const inStock = catalogVariants.find((v) => v._id === VARIANT_SHIRT_S_ID);
    expect(inStock?.sold_out).toBe(false);
  });

  it("mockQuoteForFixtures merges duplicate lines, adds shipping only for ONLINE, and rejects unknown or over-limit variants", () => {
    const onlineQuote = mockQuoteForFixtures({
      channel: "ONLINE",
      items: [
        { product_id: PRODUCT_SHIRT_ID, variant_id: VARIANT_SHIRT_S_ID, count: 1 },
        { product_id: PRODUCT_SHIRT_ID, variant_id: VARIANT_SHIRT_S_ID, count: 2 },
      ],
    });
    expect(onlineQuote.lines).toHaveLength(1);
    expect(onlineQuote.lines[0]?.count).toBe(3);
    expect(onlineQuote.subtotal).toBe(750);
    expect(onlineQuote.shipping_fee).toBe(FAKE_SHIPPING_FEE);
    expect(onlineQuote.total).toBe(750 + FAKE_SHIPPING_FEE);

    const posQuote = mockQuoteForFixtures({
      channel: "POS",
      pos_id: SHOP_MAIN_ID,
      items: [{ product_id: PRODUCT_SHIRT_ID, variant_id: VARIANT_SHIRT_S_ID, count: 2 }],
    });
    expect(posQuote.subtotal).toBe(500);
    expect(posQuote.shipping_fee).toBe(0);
    expect(posQuote.total).toBe(500);

    expect(() =>
      mockQuoteForFixtures({
        channel: "ONLINE",
        items: [{ product_id: PRODUCT_SHIRT_ID, variant_id: "64f000000000000000000099", count: 1 }],
      }),
    ).toThrowError(FixtureError);

    expect(() =>
      mockQuoteForFixtures({
        channel: "ONLINE",
        items: [
          { product_id: PRODUCT_CAP_ID, variant_id: VARIANT_CAP_RED_LIMIT_ID, count: 2 },
          { product_id: PRODUCT_CAP_ID, variant_id: VARIANT_CAP_RED_LIMIT_ID, count: 1 },
        ],
      }),
    ).toThrowError(/at most 2 per order/);
  });
});
