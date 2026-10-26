/**
 * Reads the Worker environment once and checks it with zod, so a missing or wrong
 * setting stops the server at start instead of failing on some request
 * (docs/BACKEND.md "Environment").
 *
 * Only the settings used so far are checked. Each later task adds its own
 * (PROMPTPAY_ID and SHIPPING_FEE in S4, GOOGLE_CLIENT_ID and SESSION_SECRET in S6,
 * RESEND_API_KEY and EMAIL_FROM in 2.5).
 */
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().startsWith("mongodb"),
  ADMIN_ACCESS_TOKEN: z.string().min(32, "use at least 32 random characters"),
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    // Names and reasons only, never the values.
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n- ${problems.join("\n- ")}`);
  }
  return parsed.data;
}
