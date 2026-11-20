import {
  CatalogResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  ErrorBody,
  type ErrorCode,
  FixtureError,
  fixtureProducts,
  fixtureShops,
  GoogleAuthRequest,
  MeResponse,
  mockQuoteForFixtures,
  PostcodeLookupResponse,
  QuoteResponse,
  toCatalog,
  type Product,
  type QuoteRequest,
} from "@merch/shared";
import type { z } from "zod";

export type ClientErrorCode = ErrorCode | "UNKNOWN" | "NETWORK";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
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

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}

async function requestJson<T>(
  endpoint: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${endpoint}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    throw new ApiError(0, "NETWORK", err instanceof Error ? err.message : `Network error on ${endpoint}`);
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

// Stored in-memory copy of fixtureProducts so createOrder in fixtures mode deducts stock during dev and resets on reload.
let memoryClientProducts: Product[] = structuredClone(fixtureProducts);
// Fixtures mode: signed out until googleSignIn, and each slip pays one order, as on the server.
let fixtureSignedIn = false;
let fixtureSlips = new Set<string>();

const fixtureMe: MeResponse = {
  email: "buyer@example.com",
  first_name: null,
  last_name: null,
  nickname: null,
  phone: null,
  line_id: null,
  address: null,
};

export function resetClientFixtures(): void {
  memoryClientProducts = structuredClone(fixtureProducts);
  fixtureSignedIn = false;
  fixtureSlips = new Set();
}

function requireFixtureSession(): void {
  if (!fixtureSignedIn) throw new ApiError(401, "UNAUTHORIZED", "Sign in first");
}

export async function getCatalog(): Promise<CatalogResponse> {
  if (isFixturesMode()) {
    return toCatalog(fixtureShops, memoryClientProducts);
  }
  return requestJson("/catalog", { method: "GET" }, CatalogResponse);
}

export async function quote(body: QuoteRequest): Promise<QuoteResponse> {
  if (isFixturesMode()) {
    // Fixtures mode only. In real mode the amount always comes from POST /quote.
    try {
      return mockQuoteForFixtures(body, memoryClientProducts);
    } catch (err) {
      if (err instanceof FixtureError) {
        throw new ApiError(err.status, err.code, err.message);
      }
      throw err;
    }
  }
  return requestJson("/quote", { method: "POST", body: JSON.stringify(body) }, QuoteResponse);
}

export async function createOrder(body: CreateOrderRequest): Promise<CreateOrderResponse> {
  if (isFixturesMode()) {
    const parsed = CreateOrderRequest.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError(400, "VALIDATION", issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid order");
    }
    requireFixtureSession();
    if (fixtureSlips.has(parsed.data.slip_qr_data)) {
      throw new ApiError(409, "DUPLICATE_SLIP", "This slip already paid another order");
    }
    try {
      const priced = mockQuoteForFixtures({ channel: "ONLINE", items: parsed.data.items }, memoryClientProducts);
      for (const line of priced.lines) {
        const prod = memoryClientProducts.find((p) => p._id === line.product_id);
        const variant = prod?.variants.find((v) => v._id === line.variant_id);
        if (variant) {
          variant.online_stock -= line.count;
        }
      }
      fixtureSlips.add(parsed.data.slip_qr_data);
      return {
        _id: "64d000000000000000000001",
        status: "ORDERED",
        payment_status: "PENDING_CHECK",
        subtotal: priced.subtotal,
        shipping_fee: priced.shipping_fee,
        total: priced.total,
        created_at: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof FixtureError) {
        throw new ApiError(err.status, err.code, err.message);
      }
      throw err;
    }
  }
  return requestJson("/orders", { method: "POST", body: JSON.stringify(body) }, CreateOrderResponse);
}

export async function googleSignIn(body: GoogleAuthRequest): Promise<MeResponse> {
  if (isFixturesMode()) {
    const parsed = GoogleAuthRequest.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION", "id_token is required");
    }
    fixtureSignedIn = true;
    return fixtureMe;
  }
  return requestJson("/auth/google", { method: "POST", body: JSON.stringify(body) }, MeResponse);
}

export async function getMe(): Promise<MeResponse> {
  if (isFixturesMode()) {
    requireFixtureSession();
    return fixtureMe;
  }
  return requestJson("/me", { method: "GET" }, MeResponse);
}

export async function getPostcode(code: string): Promise<PostcodeLookupResponse> {
  if (isFixturesMode()) {
    // Synthetic places, so the tambon dropdown can be tried without the server's dataset.
    return code === "10200"
      ? [
          { tambon: "Tambon 1", amphoe: "Amphoe 1", province: "Province 1" },
          { tambon: "Tambon 2", amphoe: "Amphoe 1", province: "Province 1" },
        ]
      : [];
  }
  return requestJson(`/address/postcode/${encodeURIComponent(code)}`, { method: "GET" }, PostcodeLookupResponse);
}

export const clientApi = {
  getCatalog,
  quote,
  createOrder,
  googleSignIn,
  getMe,
  getPostcode,
  resetClientFixtures,
};
