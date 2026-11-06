import {
  ErrorBody,
  type ErrorCode,
  fixtureProducts,
  fixtureShops,
  Product,
  ProductPatch,
  ProductRequest,
  Shop,
  ShopRequest,
  StockRequest,
  VariantPatch,
  VariantRequest,
} from "@merch/shared";
import { z } from "zod";

const ADMIN_TOKEN_STORAGE_KEY = "admin_token";

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

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

export function hasAdminToken(): boolean {
  const token = getAdminToken();
  return typeof token === "string" && token.length > 0;
}

// NEXT_PUBLIC_ values are baked in at build time, so changing the flag requires a rebuild.
function isFixturesMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIXTURES === "true";
}

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}

function requireAdminToken(): string {
  const token = getAdminToken();
  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing admin access token");
  }
  return token;
}

const shopListSchema = z.array(Shop);
const productListSchema = z.array(Product);

// In-memory deep-cloned copies for fixtures mode so mutations work during dev and reset on reload.
let memoryShops: Shop[] = structuredClone(fixtureShops);
let memoryProducts: Product[] = structuredClone(fixtureProducts);
let nextFixtureCounter = 100;

function makeFixtureId(prefixHex2: string): string {
  nextFixtureCounter += 1;
  return `${prefixHex2}${nextFixtureCounter.toString(16).padStart(22, "0")}`;
}

export function resetDashboardFixtures(): void {
  memoryShops = structuredClone(fixtureShops);
  memoryProducts = structuredClone(fixtureProducts);
}

async function requestAdmin<T>(
  endpoint: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const token = requireAdminToken();
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
    const product = memoryProducts.find((p) => p._id === id);
    if (!product) throw new ApiError(404, "NOT_FOUND", "Product not found");
    return structuredClone(product);
  }
  return requestAdmin(`/admin/products/${encodeURIComponent(id)}`, { method: "GET" }, Product);
}

export async function createProduct(body: ProductRequest): Promise<Product> {
  if (isFixturesMode()) {
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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
    requireAdminToken();
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

// TODO(2.8): Admin orders endpoints (list, count, detail, verify/reject payment, submit tracking).
// TODO(2.9): Admin POS management endpoints (list, create, get, transfer stock, end sale).

export const dashboardApi = {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  hasAdminToken,
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
};
