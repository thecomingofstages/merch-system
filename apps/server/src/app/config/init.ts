/**
 * Reads the Worker environment once and checks it with zod, so a missing or wrong
 * setting stops the server at start instead of failing on some request
 * (docs/BACKEND.md "Environment").
 *
 * Only the settings used so far are checked. Each later task adds its own
 * (GOOGLE_CLIENT_ID and SESSION_SECRET in S6,
 * RESEND_API_KEY and EMAIL_FROM in 2.5).
 */
import { z } from "zod";
import { appConfSchema } from "./app.conf";
import { appKeysSchema } from "./app.keys";
import { dbKeysSchema } from "./db.keys";

const envSchema = appConfSchema.merge(appKeysSchema).merge(dbKeysSchema);

export type Config = z.infer<typeof envSchema>;

export function initConfig(env: Record<string, unknown>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Names and reasons only, never the values.
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n- ${problems.join("\n- ")}`);
  }
  return parsed.data;
}
