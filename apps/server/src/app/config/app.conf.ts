/** Non-secret app settings: Wrangler `vars` (docs/BACKEND.md "Environment"). */
import { z } from "zod";

export const appConfSchema = z.object({
  /** Comma-separated origins of the client and the dashboard (F6). */
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
  /** Flat shipping per online order, whole baht (S4). Shortcut until the per-shop setting is built. */
  SHIPPING_FEE: z.string().trim().regex(/^\d+$/, "a whole number of baht").transform(Number),
  /** Sender of the buyer's emails, on the domain verified in Resend (I6), e.g. `Shop <shop@example.com>`. */
  EMAIL_FROM: z.string().trim().min(3),
});

/** Fixed settings that are not environment values. */
export const appConf = {
  jsonLimit: "100kb",
  ordersPageSize: 20,
  sessionCookie: "merch_session",
  sessionMaxAgeSeconds: 30 * 24 * 60 * 60,
} as const;
