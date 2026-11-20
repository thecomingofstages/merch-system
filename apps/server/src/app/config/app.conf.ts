/** Non-secret app settings: Text variables in the Cloudflare dashboard, kept by deploys through keep_vars (docs/BACKEND.md "Environment"). */
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
  /** The custom domain of the R2 images bucket, e.g. `https://images.example.com` (D17). */
  IMAGES_PUBLIC_URL: z.string().trim().url().transform((u) => u.replace(/\/+$/, "")),
  /** The R2 bucket binding from wrangler.jsonc, not a text setting. */
  IMAGES: z.custom<R2Bucket>((v) => typeof v === "object" && v !== null && "put" in v, "R2 binding missing (wrangler.jsonc r2_buckets)"),
});

/** Fixed settings that are not environment values. */
export const appConf = {
  jsonLimit: "100kb",
  /** Uploaded or copied image size cap (D17); the dashboard shrinks photos well below it. */
  imageMaxBytes: 5 * 1024 * 1024,
  ordersPageSize: 20,
  sessionCookie: "merch_session",
  sessionMaxAgeSeconds: 30 * 24 * 60 * 60,
} as const;
