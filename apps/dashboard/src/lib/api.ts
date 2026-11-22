import {
  ANALYTICS_STEPS,
  type AnalyticsCounts,
  type AnalyticsStep,
  AnalyticsDailyResponse,
  AnalyticsDeleteResponse,
  type AnalyticsRange,
  AnalyticsSummaryResponse,
  AdminOrdersCountQuery,
  AdminOrdersCountResponse,
  AdminOrdersQuery,
  AdminOrdersResponse,
  deleteImpact,
  ErrorBody,
  ImageUploadResponse,
  ImportRequest,
  ImportResponse,
  type ErrorCode,
  fixtureOrders,
  fixtureProducts,
  fixturePromotions,
  fixtureSettings,
  fixtureShops,
  Product,
  ProductPatch,
  ProductRequest,
  Promotion,
  PromotionRequest,
  Settings,
  Purchase,
  Shop,
  ShopRequest,
  StockRequest,
  UpdateOrderPaymentRequest,
  UpdateOrderTrackingRequest,
  VariantPatch,
  VariantRequest,
} from "@merch/shared";
import { z } from "zod";

export type DashboardErrorCode = ErrorCode | "UNKNOWN" | "NETWORK";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: DashboardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// NEXT_PUBLIC_ values are baked in at build time, so changing the flag requires a rebuild.
export function isFixturesMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIXTURES === "true";
}

const shopListSchema = z.array(Shop);
const productListSchema = z.array(Product);

// In-memory deep-cloned copies for fixtures mode so mutations work during dev and reset on reload.
let memoryShops: Shop[] = structuredClone(fixtureShops);
let memoryProducts: Product[] = structuredClone(fixtureProducts);
let memoryOrders: Purchase[] = structuredClone(fixtureOrders);
let memoryPromotions: Promotion[] = structuredClone(fixturePromotions);
let memorySettings: Settings = structuredClone(fixtureSettings);
let nextFixtureCounter = 100;

function makeFixtureId(prefixHex2: string): string {
  nextFixtureCounter += 1;
  return `${prefixHex2}${nextFixtureCounter.toString(16).padStart(22, "0")}`;
}

export function resetDashboardFixtures(): void {
  memoryShops = structuredClone(fixtureShops);
  memoryProducts = structuredClone(fixtureProducts);
  memoryOrders = structuredClone(fixtureOrders);
  memoryPromotions = structuredClone(fixturePromotions);
  memorySettings = structuredClone(fixtureSettings);
}

/** Fixtures mode: the server's cascade (D13) when products, or one variant, are deleted. */
function cascadeFixtureSets(target: { productIds: string[] } | { variantId: string }) {
  const { deleted } = deleteImpact(memoryPromotions, target);
  for (const set of deleted) set.archived = true;
  if ("variantId" in target) {
    for (const set of memoryPromotions) {
      for (const item of set.items) item.variant_ids = item.variant_ids.filter((v) => v !== target.variantId);
    }
  }
}

/** Calls apps/server through this dashboard's own /api route, which adds ADMIN_ACCESS_TOKEN (D15). */
async function requestAdmin<S extends z.ZodTypeAny>(
  endpoint: string,
  init: RequestInit,
  schema: S,
): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await fetch(`/api${endpoint}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    throw new ApiError(0, "NETWORK", err instanceof Error ? err.message : `Network error on ${endpoint}`);
  }

  if (res.status === 204) {
    const parsed = schema.safeParse(undefined);
    if (!parsed.success) {
      throw new Error(`Invalid response from ${endpoint}: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const parsedErr = ErrorBody.safeParse(json);
    if (parsedErr.success) {
      throw new ApiError(res.status, parsedErr.data.error.code, parsedErr.data.error.message);
    }
    throw new ApiError(res.status, "UNKNOWN", `Request to ${endpoint} failed with status ${res.status}`);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid response from ${endpoint}: ${parsed.error.message}`);
  }
  return parsed.data;
}

// Shops

export async function listShops(options?: { includeArchived?: boolean }): Promise<Shop[]> {
  if (isFixturesMode()) {
    const includeArchived = Boolean(options?.includeArchived);
    return structuredClone(
      memoryShops.filter((s) => includeArchived || !s.archived),
    );
  }
  const query = options?.includeArchived ? "?archived=true" : "";
  return requestAdmin(`/admin/shops${query}`, { method: "GET" }, shopListSchema);
}

export async function createShop(body: ShopRequest): Promise<Shop> {
  if (isFixturesMode()) {
    const parsed = ShopRequest.parse(body);
    const created: Shop = {
      _id: makeFixtureId("65"),
      shop_name: parsed.shop_name,
      archived: false,
    };
    memoryShops.push(created);
    return structuredClone(created);
  }
  return requestAdmin("/admin/shops", { method: "POST", body: JSON.stringify(body) }, Shop);
}

export async function updateShop(id: string, body: ShopRequest): Promise<Shop> {
  if (isFixturesMode()) {
    const parsed = ShopRequest.parse(body);
    const shop = memoryShops.find((s) => s._id === id && !s.archived);
    if (!shop) throw new ApiError(404, "NOT_FOUND", "Shop not found");
    shop.shop_name = parsed.shop_name;
    return structuredClone(shop);
  }
  return requestAdmin(`/admin/shops/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }, Shop);
}

export async function archiveShop(id: string): Promise<void> {
  if (isFixturesMode()) {
    const shop = memoryShops.find((s) => s._id === id && !s.archived);
    if (!shop) throw new ApiError(404, "NOT_FOUND", "Shop not found");
    const shopProducts = memoryProducts.filter((p) => p.shop_id === id && !p.archived);
    const hasStock = shopProducts.some((p) => p.variants.some((v) => v.online_stock > 0));
    if (hasStock) {
      throw new ApiError(409, "IN_USE", "Still has online stock: move it to 0 first");
    }
    for (const p of memoryProducts) {
      if (p.shop_id === id) {
        p.archived = true;
        for (const v of p.variants) v.archived = true;
      }
    }
    cascadeFixtureSets({ productIds: shopProducts.map((p) => p._id) });
    shop.archived = true;
    return;
  }
  await requestAdmin(`/admin/shops/${encodeURIComponent(id)}`, { method: "DELETE" }, z.undefined());
}

// Products

export async function listProducts(options?: { shopId?: string; includeArchived?: boolean }): Promise<Product[]> {
  if (isFixturesMode()) {
    const includeArchived = Boolean(options?.includeArchived);
    return structuredClone(
      memoryProducts.filter(
        (p) =>
          (!options?.shopId || p.shop_id === options.shopId) &&
          (includeArchived || !p.archived),
      ),
    );
  }
  const params = new URLSearchParams();
  if (options?.shopId) params.set("shop_id", options.shopId);
  if (options?.includeArchived) params.set("archived", "true");
  const qs = params.toString();
  return requestAdmin(`/admin/products${qs ? `?${qs}` : ""}`, { method: "GET" }, productListSchema);
}

export async function getProduct(id: string): Promise<Product> {
  if (isFixturesMode()) {
    const product = memoryProducts.find((p) => p._id === id);
    if (!product) throw new ApiError(404, "NOT_FOUND", "Product not found");
    return structuredClone(product);
  }
  return requestAdmin(`/admin/products/${encodeURIComponent(id)}`, { method: "GET" }, Product);
}

export async function createProduct(body: ProductRequest): Promise<Product> {
  if (isFixturesMode()) {
    const parsed = ProductRequest.parse(body);
    const shop = memoryShops.find((s) => s._id === parsed.shop_id && !s.archived);
    if (!shop) throw new ApiError(400, "VALIDATION", "shop_id: no such shop");
    const created: Product = {
      _id: makeFixtureId("66"),
      shop_id: parsed.shop_id,
      name: parsed.name,
      description: parsed.description,
      image: [...parsed.image],
      archived: false,
      variants: parsed.variants.map((v) => ({
        _id: makeFixtureId("67"),
        name: v.name,
        price: v.price,
        image: v.image,
        online_stock: 0,
        buy_limit: v.buy_limit,
        visible_to_online: v.visible_to_online,
        archived: false,
      })),
    };
    memoryProducts.push(created);
    return structuredClone(created);
  }
  return requestAdmin("/admin/products", { method: "POST", body: JSON.stringify(body) }, Product);
}

export async function updateProduct(id: string, body: ProductPatch): Promise<Product> {
  if (isFixturesMode()) {
    const parsed = ProductPatch.parse(body);
    const product = memoryProducts.find((p) => p._id === id && !p.archived);
    if (!product) throw new ApiError(404, "NOT_FOUND", "Product not found");
    if (parsed.shop_id !== undefined) {
      const shop = memoryShops.find((s) => s._id === parsed.shop_id && !s.archived);
      if (!shop) throw new ApiError(400, "VALIDATION", "shop_id: no such shop");
      product.shop_id = parsed.shop_id;
    }
    if (parsed.name !== undefined) product.name = parsed.name;
    if (parsed.description !== undefined) product.description = parsed.description;
    if (parsed.image !== undefined) product.image = [...parsed.image];
    return structuredClone(product);
  }
  return requestAdmin(
    `/admin/products/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
    Product,
  );
}

export async function archiveProduct(id: string): Promise<void> {
  if (isFixturesMode()) {
    const product = memoryProducts.find((p) => p._id === id && !p.archived);
    if (!product) throw new ApiError(404, "NOT_FOUND", "Product not found");
    if (product.variants.some((v) => v.online_stock > 0)) {
      throw new ApiError(409, "IN_USE", "Still has online stock: move it to 0 first");
    }
    product.archived = true;
    for (const v of product.variants) v.archived = true;
    cascadeFixtureSets({ productIds: [id] });
    return;
  }
  await requestAdmin(`/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" }, z.undefined());
}

// Variants

export async function createVariant(productId: string, body: VariantRequest): Promise<Product> {
  if (isFixturesMode()) {
    const parsed = VariantRequest.parse(body);
    const product = memoryProducts.find((p) => p._id === productId && !p.archived);
    if (!product) throw new ApiError(404, "NOT_FOUND", "Product not found");
    product.variants.push({
      _id: makeFixtureId("67"),
      name: parsed.name,
      price: parsed.price,
      image: parsed.image,
      online_stock: 0,
      buy_limit: parsed.buy_limit,
      visible_to_online: parsed.visible_to_online,
      archived: false,
    });
    return structuredClone(product);
  }
  return requestAdmin(
    `/admin/products/${encodeURIComponent(productId)}/variants`,
    { method: "POST", body: JSON.stringify(body) },
    Product,
  );
}

export async function updateVariant(productId: string, variantId: string, body: VariantPatch): Promise<Product> {
  if (isFixturesMode()) {
    const parsed = VariantPatch.parse(body);
    const product = memoryProducts.find((p) => p._id === productId && !p.archived);
    const variant = product?.variants.find((v) => v._id === variantId && !v.archived);
    if (!product || !variant) throw new ApiError(404, "NOT_FOUND", "Variant not found");
    if (parsed.name !== undefined) variant.name = parsed.name;
    if (parsed.price !== undefined) variant.price = parsed.price;
    if (parsed.image !== undefined) variant.image = parsed.image;
    if (parsed.buy_limit !== undefined) variant.buy_limit = parsed.buy_limit;
    if (parsed.visible_to_online !== undefined) variant.visible_to_online = parsed.visible_to_online;
    return structuredClone(product);
  }
  return requestAdmin(
    `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
    Product,
  );
}

export async function archiveVariant(productId: string, variantId: string): Promise<void> {
  if (isFixturesMode()) {
    const product = memoryProducts.find((p) => p._id === productId && !p.archived);
    const variant = product?.variants.find((v) => v._id === variantId && !v.archived);
    if (!product || !variant) throw new ApiError(404, "NOT_FOUND", "Variant not found");
    if (variant.online_stock > 0) {
      throw new ApiError(409, "IN_USE", "Still has online stock: move it to 0 first");
    }
    variant.archived = true;
    cascadeFixtureSets({ variantId });
    return;
  }
  await requestAdmin(
    `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    { method: "DELETE" },
    z.undefined(),
  );
}

export async function addStock(productId: string, variantId: string, body: StockRequest): Promise<Product> {
  if (isFixturesMode()) {
    const parsed = StockRequest.parse(body);
    const product = memoryProducts.find((p) => p._id === productId && !p.archived);
    const variant = product?.variants.find((v) => v._id === variantId && !v.archived);
    if (!product || !variant) throw new ApiError(404, "NOT_FOUND", "Variant not found");
    if (variant.online_stock + parsed.amount < 0) {
      throw new ApiError(409, "OUT_OF_STOCK", "Can't remove more than the online stock");
    }
    variant.online_stock += parsed.amount;
    return structuredClone(product);
  }
  return requestAdmin(
    `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/stock`,
    { method: "POST", body: JSON.stringify(body) },
    Product,
  );
}

// Import (D19)

/** Creates shops, products and variants from a parsed sheet, all or nothing. */
export async function importCatalog(body: ImportRequest): Promise<ImportResponse> {
  if (isFixturesMode()) {
    const parsed = ImportRequest.parse(body);
    let shops_created = 0;
    let variants_created = 0;
    for (const s of parsed.shops) {
      let shop = memoryShops.find((x) => x.shop_name === s.shop_name && !x.archived);
      if (!shop) {
        shop = { _id: makeFixtureId("65"), shop_name: s.shop_name, archived: false };
        memoryShops.push(shop);
        shops_created += 1;
      }
      for (const p of s.products) {
        variants_created += p.variants.length;
        memoryProducts.push({
          _id: makeFixtureId("66"),
          shop_id: shop._id,
          name: p.name,
          description: p.description,
          image: p.image,
          archived: false,
          variants: p.variants.map((v) => ({ ...v, _id: makeFixtureId("67"), archived: false })),
        });
      }
    }
    return { shops_created, products_created: parsed.shops.reduce((n, s) => n + s.products.length, 0), variants_created };
  }
  return requestAdmin("/admin/import", { method: "POST", body: JSON.stringify(body) }, ImportResponse);
}

// Images (D17)

/** Uploads one image file to R2 through the server; answers its public URL. */
export async function uploadImage(file: Blob): Promise<string> {
  // Fixtures: a placeholder https address, so the form's link check still passes.
  if (isFixturesMode()) return `https://example.invalid/uploaded/${Date.now()}.webp`;
  const res = await requestAdmin(
    "/admin/images",
    { method: "POST", body: file, headers: { "Content-Type": file.type } },
    ImageUploadResponse,
  );
  return res.url;
}

// Shop-wide promotion settings (D22)

export async function getSettings(): Promise<Settings> {
  if (isFixturesMode()) return structuredClone(memorySettings);
  return requestAdmin("/admin/settings", { method: "GET" }, Settings);
}

export async function saveSettings(body: Settings): Promise<Settings> {
  if (isFixturesMode()) {
    memorySettings = Settings.parse(body);
    return structuredClone(memorySettings);
  }
  return requestAdmin("/admin/settings", { method: "PATCH", body: JSON.stringify(body) }, Settings);
}

// Promotion sets (D13)

const promotionListSchema = z.array(Promotion);

export async function listPromotions(): Promise<Promotion[]> {
  if (isFixturesMode()) {
    return structuredClone(memoryPromotions.filter((p) => !p.archived));
  }
  return requestAdmin("/admin/promotions", { method: "GET" }, promotionListSchema);
}

export async function savePromotion(id: string | null, body: PromotionRequest): Promise<Promotion> {
  if (isFixturesMode()) {
    const parsed = PromotionRequest.parse(body);
    if (id === null) {
      const created: Promotion = { ...parsed, _id: makeFixtureId("6e"), archived: false };
      memoryPromotions.push(created);
      return structuredClone(created);
    }
    const existing = memoryPromotions.find((p) => p._id === id && !p.archived);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Promotion not found");
    Object.assign(existing, parsed);
    return structuredClone(existing);
  }
  return requestAdmin(
    id === null ? "/admin/promotions" : `/admin/promotions/${encodeURIComponent(id)}`,
    { method: id === null ? "POST" : "PATCH", body: JSON.stringify(body) },
    Promotion,
  );
}

export async function archivePromotion(id: string): Promise<void> {
  if (isFixturesMode()) {
    const promotion = memoryPromotions.find((p) => p._id === id && !p.archived);
    if (!promotion) throw new ApiError(404, "NOT_FOUND", "Promotion not found");
    promotion.archived = true;
    return;
  }
  await requestAdmin(`/admin/promotions/${encodeURIComponent(id)}`, { method: "DELETE" }, z.undefined());
}

// Usage statistics (D21)

const rangeQuery = (range: AnalyticsRange, extra: Record<string, string> = {}) => {
  const q = new URLSearchParams({ ...(range.from && { from: range.from }), ...(range.to && { to: range.to }), ...extra }).toString();
  return q ? `?${q}` : "";
};

/** Fixtures mode: a fixed, made-up funnel per fixture product, so the page can be tried offline. */
const fixtureSteps = (n: number) =>
  Object.fromEntries(
    ANALYTICS_STEPS.map((s, i) => {
      const sessions = Math.max(Math.round(n / (i + 1) ** 1.4), i === 4 ? 1 : 0);
      return [s, { hits: sessions + Math.round(sessions / 3), sessions, visitors: Math.round(sessions * 0.8) }];
    }),
  ) as Record<AnalyticsStep, AnalyticsCounts>;

export async function getAnalytics(range: AnalyticsRange): Promise<AnalyticsSummaryResponse> {
  if (isFixturesMode()) {
    return {
      totals: { visitors: 96, sessions: 120, purchased_sessions: 14 },
      products: memoryProducts.filter((p) => !p.archived).map((p, i) => ({ ...fixtureSteps(80 - i * 15), product_id: p._id, product_name: p.name })),
    };
  }
  return requestAdmin(`/admin/analytics${rangeQuery(range)}`, { method: "GET" }, AnalyticsSummaryResponse);
}

export async function getAnalyticsDaily(productId: string, range: AnalyticsRange): Promise<AnalyticsDailyResponse> {
  if (isFixturesMode()) {
    const today = new Date();
    return {
      days: Array.from({ length: 10 }, (_, i) => {
        const d = new Date(today.getTime() - (9 - i) * 86_400_000).toISOString().slice(0, 10);
        return { ...fixtureSteps(12 + ((i * 7) % 9)), date: d };
      }),
    };
  }
  return requestAdmin(`/admin/analytics/${encodeURIComponent(productId)}/daily${rangeQuery(range)}`, { method: "GET" }, AnalyticsDailyResponse);
}

/** Every event before that day (YYYY-MM-DD), or all of them. */
export async function deleteAnalytics(before?: string): Promise<AnalyticsDeleteResponse> {
  if (isFixturesMode()) return { deleted: 0 };
  return requestAdmin(`/admin/analytics${rangeQuery({}, before ? { before } : {})}`, { method: "DELETE" }, AnalyticsDeleteResponse);
}

// Orders (2.8)

const ORDERS_PAGE_SIZE = 20;

function matchesOnlineOrdersFilter(order: Purchase, q?: AdminOrdersCountQuery): boolean {
  if (order.pos_id !== null) return false;
  if (q?.status && order.status !== q.status) return false;
  if (q?.payment_status) {
    return order.payment_status === q.payment_status;
  }
  return order.payment_status !== "REJECTED";
}

export async function listOrders(query?: AdminOrdersQuery): Promise<AdminOrdersResponse> {
  if (isFixturesMode()) {
    const parsedQuery = query ? AdminOrdersQuery.parse(query) : {};
    const page = parsedQuery.page ?? 1;
    const filtered = memoryOrders
      .filter((o) => matchesOnlineOrdersFilter(o, parsedQuery))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const start = (page - 1) * ORDERS_PAGE_SIZE;
    const orders = structuredClone(filtered.slice(start, start + ORDERS_PAGE_SIZE));
    return {
      orders,
      total: filtered.length,
      page,
      page_size: ORDERS_PAGE_SIZE,
    };
  }
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.payment_status) params.set("payment_status", query.payment_status);
  if (query?.page) params.set("page", String(query.page));
  const qs = params.toString();
  return requestAdmin(
    `/admin/orders${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    AdminOrdersResponse,
  );
}

export async function countOrders(query?: AdminOrdersCountQuery): Promise<AdminOrdersCountResponse> {
  if (isFixturesMode()) {
    const parsedQuery = query ? AdminOrdersCountQuery.parse(query) : {};
    const count = memoryOrders.filter((o) => matchesOnlineOrdersFilter(o, parsedQuery)).length;
    return { count };
  }
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.payment_status) params.set("payment_status", query.payment_status);
  const qs = params.toString();
  return requestAdmin(
    `/admin/orders/count${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    AdminOrdersCountResponse,
  );
}

export async function getOrder(id: string): Promise<Purchase> {
  if (isFixturesMode()) {
    const order = memoryOrders.find((o) => o._id === id);
    if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");
    return structuredClone(order);
  }
  return requestAdmin(`/admin/orders/${encodeURIComponent(id)}`, { method: "GET" }, Purchase);
}

export async function updateOrderPayment(
  id: string,
  body: UpdateOrderPaymentRequest,
): Promise<Purchase> {
  if (isFixturesMode()) {
    const parsed = UpdateOrderPaymentRequest.parse(body);
    const order = memoryOrders.find((o) => o._id === id);
    if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");
    if (order.pos_id !== null) {
      throw new ApiError(400, "VALIDATION", "A POS sale has no payment check");
    }
    // Same rule as the server: a REFUND_DUE order can only be rejected, and never took stock.
    const refundDue = order.payment_status === "REFUND_DUE" && parsed.payment_status === "REJECTED";
    if (order.payment_status !== "PENDING_CHECK" && !refundDue) {
      throw new ApiError(409, "NOT_PENDING", `This order is already ${order.payment_status}`);
    }
    order.payment_status = parsed.payment_status;
    if (parsed.payment_status === "VERIFIED") {
      order.verified_at = new Date().toISOString();
    } else if (!refundDue) {
      for (const line of order.products) {
        const product = memoryProducts.find((p) => p._id === line.products_id);
        if (!product) continue;
        for (const vLine of line.variants) {
          const variant = product.variants.find((v) => v._id === vLine.variants_id);
          if (variant) {
            variant.online_stock += vLine.count;
          }
        }
      }
    }
    return structuredClone(order);
  }
  return requestAdmin(
    `/admin/orders/${encodeURIComponent(id)}/payment`,
    { method: "PATCH", body: JSON.stringify(body) },
    Purchase,
  );
}

export async function updateOrderTracking(
  id: string,
  body: UpdateOrderTrackingRequest,
): Promise<Purchase> {
  if (isFixturesMode()) {
    const parsed = UpdateOrderTrackingRequest.parse(body);
    const order = memoryOrders.find((o) => o._id === id);
    if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");
    if (order.pos_id !== null) {
      throw new ApiError(400, "VALIDATION", "A POS sale can't get a tracking ID");
    }
    if (order.payment_status !== "VERIFIED") {
      throw new ApiError(409, "NOT_VERIFIED", "Verify the payment before shipping");
    }
    order.tracking_id = parsed.tracking_id;
    order.status = "SHIPPING";
    return structuredClone(order);
  }
  return requestAdmin(
    `/admin/orders/${encodeURIComponent(id)}/tracking`,
    { method: "PATCH", body: JSON.stringify(body) },
    Purchase,
  );
}

// TODO(2.9): Admin POS management endpoints (list, create, get, transfer stock, end sale).

export const dashboardApi = {
  isFixturesMode,
  resetDashboardFixtures,
  listShops,
  createShop,
  updateShop,
  archiveShop,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  createVariant,
  updateVariant,
  archiveVariant,
  addStock,
  listOrders,
  countOrders,
  getOrder,
  updateOrderPayment,
  updateOrderTracking,
};
