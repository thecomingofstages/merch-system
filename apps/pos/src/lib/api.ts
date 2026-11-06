/**
 * POS API helper.
 * The POS browser NEVER calls apps/server directly and never reads NEXT_PUBLIC_API_URL
 * or ADMIN_ACCESS_TOKEN. It calls its own Next.js server at `/api/...`, which adds
 * ADMIN_ACCESS_TOKEN from the VM's environment and forwards the request (F7, D6).
 */
import {
  CreatePosSaleRequest,
  ErrorBody,
  type ErrorCode,
  FixtureError,
  fixtureProducts,
  mockQuoteForFixtures,
  Pos,
  PosSummary,
  CreatePosSaleResponse,
  QuoteResponse,
  SHOP_MAIN_ID,
  SHOP_STAGE_ID,
  type CartItem,
  type Product,
  type QuoteRequest,
} from "@merch/shared";
import { z } from "zod";

// TODO(F7): Next.js route `apps/pos/src/app/api/[...path]/route.ts` forwards `/api/*` to apps/server with ADMIN_ACCESS_TOKEN.
const BASE = "/api";

export type PosErrorCode = ErrorCode | "UNKNOWN" | "NETWORK";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: PosErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// NEXT_PUBLIC_ values are baked in at build time, so changing the flag requires a rebuild.
function isFixturesMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIXTURES === "true";
}

const posListSchema = z.array(PosSummary);

// Temporary in-memory POS instances derived from product fixtures for fixtures mode only.
let memoryPosList: Pos[] = [
  {
    _id: "64e000000000000000000001",
    name: "POS A (Placeholder)",
    shop_ids: [SHOP_MAIN_ID, SHOP_STAGE_ID],
    products: fixtureProducts
      .filter((p) => !p.archived)
      .map((p) => ({
        product_id: p._id,
        variants: p.variants
          .filter((v) => !v.archived)
          .map((v) => ({
            variants_id: v._id,
            pos_stock: v.online_stock,
          })),
      })),
    stock_log: [],
  },
];

export function resetPosFixtures(): void {
  memoryPosList = [
    {
      _id: "64e000000000000000000001",
      name: "POS A (Placeholder)",
      shop_ids: [SHOP_MAIN_ID, SHOP_STAGE_ID],
      products: fixtureProducts
        .filter((p) => !p.archived)
        .map((p) => ({
          product_id: p._id,
          variants: p.variants
            .filter((v) => !v.archived)
            .map((v) => ({
              variants_id: v._id,
              pos_stock: v.online_stock,
            })),
        })),
      stock_log: [],
    },
  ];
}

async function requestPos<T>(
  endpoint: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${endpoint}`, {
      ...init,
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

export async function getPosList(): Promise<PosSummary[]> {
  if (isFixturesMode()) {
    return structuredClone(memoryPosList);
  }
  return requestPos("/admin/pos", { method: "GET" }, posListSchema);
}

export async function getPos(id: string): Promise<Pos> {
  if (isFixturesMode()) {
    const found = memoryPosList.find((p) => p._id === id);
    if (!found) throw new ApiError(404, "NOT_FOUND", "POS not found");
    return structuredClone(found);
  }
  return requestPos(`/admin/pos/${encodeURIComponent(id)}`, { method: "GET" }, Pos);
}

export async function quote(body: { channel?: "POS"; pos_id: string; items: CartItem[] }): Promise<QuoteResponse> {
  const payload: QuoteRequest = {
    channel: "POS",
    pos_id: body.pos_id,
    items: body.items,
  };
  if (isFixturesMode()) {
    // Fixtures mode only. In real mode the amount always comes from POST /quote.
    const pos = memoryPosList.find((p) => p._id === payload.pos_id);
    if (!pos) throw new ApiError(404, "NOT_FOUND", "POS not found");
    const posProducts: Product[] = fixtureProducts
      .filter((p) => !p.archived && pos.shop_ids.includes(p.shop_id))
      .map((p) => {
        const posProd = pos.products.find((pp) => pp.product_id === p._id);
        return {
          ...p,
          variants: p.variants.map((v) => {
            const posVar = posProd?.variants.find((pv) => pv.variants_id === v._id);
            return { ...v, online_stock: posVar ? posVar.pos_stock : 0 };
          }),
        };
      });
    try {
      return mockQuoteForFixtures(payload, posProducts);
    } catch (err) {
      if (err instanceof FixtureError) {
        throw new ApiError(err.status, err.code, err.message);
      }
      throw err;
    }
  }
  return requestPos("/quote", { method: "POST", body: JSON.stringify(payload) }, QuoteResponse);
}

export async function createSale(posId: string, body: CreatePosSaleRequest): Promise<CreatePosSaleResponse> {
  if (isFixturesMode()) {
    const parsed = CreatePosSaleRequest.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError(400, "VALIDATION", issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid POS sale");
    }
    const priced = await quote({ pos_id: posId, items: parsed.data.items });
    const pos = memoryPosList.find((p) => p._id === posId)!;
    for (const line of priced.lines) {
      const posProd = pos.products.find((pp) => pp.product_id === line.product_id);
      const posVar = posProd?.variants.find((pv) => pv.variants_id === line.variant_id);
      if (posVar) {
        posVar.pos_stock -= line.count;
      }
    }
    return {
      _id: "64f000000000000000000001",
      verify_method: parsed.data.verify_method,
      payment_status: "VERIFIED",
      subtotal: priced.subtotal,
      shipping_fee: 0,
      total: priced.total,
      created_at: new Date().toISOString(),
    };
  }
  return requestPos(
    `/pos/${encodeURIComponent(posId)}/sales`,
    { method: "POST", body: JSON.stringify(body) },
    CreatePosSaleResponse,
  );
}

// TODO(POS product source): BACKEND.md does not list a non-admin product endpoint for POS besides GET /admin/products.
// Temporary fixtures-only product helper filtered by optional shopIds.
export async function getPosProductsForFixtures(shopIds?: readonly string[]): Promise<Product[]> {
  if (!isFixturesMode()) {
    throw new Error("TODO(POS product source): confirm real POS product listing endpoint before disabling fixtures");
  }
  const filtered = fixtureProducts.filter(
    (p) => !p.archived && (!shopIds || shopIds.includes(p.shop_id)),
  );
  return structuredClone(filtered);
}

export const posApi = {
  getPosList,
  getPos,
  quote,
  createSale,
  getPosProductsForFixtures,
  resetPosFixtures,
};
