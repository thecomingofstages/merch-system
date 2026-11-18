import { describe, expect, it } from "vitest";
import {
  baht,
  CatalogResponse,
  FAKE_SHIPPING_FEE,
  FixtureError,
  fixtureCatalog,
  fixtureOrders,
  fixtureProducts,
  fixtureShops,
  formatThaiAddress,
  mockQuoteForFixtures,
  objectId,
  Product,
  PRODUCT_ARCHIVED_ID,
  PRODUCT_CAP_ID,
  PRODUCT_SHIRT_ID,
  ProductRequest,
  Purchase,
  QuoteResponse,
  Shop,
  SHOP_MAIN_ID,
  toCatalog,
  Variant,
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
      expect(() => Product.parse(product)).not.toThrow();
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
        expect(() => Variant.parse(variant)).not.toThrow();
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

    expect(() => CatalogResponse.parse(fixtureCatalog)).not.toThrow();
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
    expect(() => QuoteResponse.parse(onlineQuote)).not.toThrow();
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

  it("fixtureOrders (2.8) parses with Purchase schema, covers all required states, and has unique slip_qr_data", () => {
    expect(fixtureOrders.length).toBeGreaterThanOrEqual(5);

    const productIds = new Set(fixtureProducts.map((p) => p._id));
    const variantIds = new Set(fixtureProducts.flatMap((p) => p.variants.map((v) => v._id)));
    const slips: string[] = [];

    for (const order of fixtureOrders) {
      expect(() => Purchase.parse(order)).not.toThrow();
      expect(() => objectId.parse(order._id)).not.toThrow();

      for (const line of order.products) {
        expect(productIds.has(line.products_id)).toBe(true);
        for (const v of line.variants) {
          expect(variantIds.has(v.variants_id)).toBe(true);
        }
      }

      if (order.slip_qr_data !== undefined) {
        slips.push(order.slip_qr_data);
      } else {
        expect("slip_qr_data" in order).toBe(false);
      }
    }

    // Unique slip_qr_data
    expect(new Set(slips).size).toBe(slips.length);

    // State coverage
    expect(fixtureOrders.some((o) => o.payment_status === "PENDING_CHECK")).toBe(true);
    expect(
      fixtureOrders.some((o) => o.payment_status === "VERIFIED" && o.status === "ORDERED" && o.pos_id === null),
    ).toBe(true);
    expect(fixtureOrders.some((o) => o.payment_status === "REJECTED")).toBe(true);
    expect(fixtureOrders.some((o) => o.status === "SHIPPING" && Boolean(o.tracking_id))).toBe(true);

    // POS sale coverage
    const posSale = fixtureOrders.find((o) => o.pos_id !== null);
    expect(posSale).toBeDefined();
    expect(posSale?.users).toBeNull();
    expect(posSale?.verify_method).toBe("MANUAL");
    expect(posSale && "slip_qr_data" in posSale).toBe(false);
    expect(posSale?.recipient).toBeNull();
    expect(posSale?.shipping_address).toBeNull();

    // Multi-product & multi-variant order, Bangkok vs non-Bangkok address, line_id: null
    expect(
      fixtureOrders.some(
        (o) => o.products.length > 1 && o.products.some((p) => p.variants.length > 1),
      ),
    ).toBe(true);
    expect(
      fixtureOrders.some(
        (o) =>
          o.shipping_address !== null &&
          formatThaiAddress(o.shipping_address).includes("แขวง") &&
          formatThaiAddress(o.shipping_address).includes("เขต"),
      ),
    ).toBe(true);
    expect(
      fixtureOrders.some(
        (o) =>
          o.shipping_address !== null &&
          formatThaiAddress(o.shipping_address).includes("ตำบล") &&
          formatThaiAddress(o.shipping_address).includes("อำเภอ"),
      ),
    ).toBe(true);
    expect(fixtureOrders.some((o) => o.recipient !== null && o.recipient.line_id === null)).toBe(true);
  });
});
