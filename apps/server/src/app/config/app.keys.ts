/**
 * App secrets: set with `npx wrangler secret put <NAME>`, and in .dev.vars locally.
 * Never log these or put them in an error message.
 */
import { z } from "zod";

export const appKeysSchema = z.object({
  /** Shared by the dashboard and the POS for every /admin/* route (D6, F6). */
  ADMIN_ACCESS_TOKEN: z.string().min(32, "use at least 32 random characters"),
  /** The PromptPay ID every shop is paid to; sent with each quote for the QR (S4). */
  PROMPTPAY_ID: z.string().trim().min(1),
});
