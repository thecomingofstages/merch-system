/** Non-secret app settings: Wrangler `vars` (docs/BACKEND.md "Environment"). */
import { z } from "zod";

export const appConfSchema = z.object({
  /** Comma-separated origins of the client and the dashboard (F6). */
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
});

/** Fixed settings that are not environment values. */
export const appConf = {
  jsonLimit: "100kb",
} as const;
