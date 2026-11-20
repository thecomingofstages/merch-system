import {
  AdminOrdersCountQuery,
  AdminOrdersCountResponse,
  AdminOrdersQuery,
  AdminOrdersResponse,
  ErrorBody,
  type ErrorCode,
  fixtureOrders,
  fixtureProducts,
  fixtureShops,
  Product,
  ProductPatch,
  ProductRequest,
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
let nextFixtureCounter = 100;

function makeFixtureId(prefixHex2: string): string {
  nextFixtureCounter += 1;
  return `${prefixHex2}${nextFixtureCounter.toString(16).padStart(22, "0")}`;
}

export function resetDashboardFixtures(): void {
  memoryShops = structuredClone(fixtureShops);
  memoryProducts = structuredClone(fixtureProducts);
  memoryOrders = structuredClone(fixtureOrders);
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
