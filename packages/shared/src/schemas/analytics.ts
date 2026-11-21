import { z } from "zod";

/**
 * POST /analytics/consent (D20): the visitor's answer to the usage-statistics question.
 * `visitor_id` is the random id the browser made when they accepted; a decline that was never
 * preceded by an accept sends nothing, so no id ever exists for it.
 */
export const AnalyticsConsentRequest = z.object({
  visitor_id: z.string().uuid(),
  accepted: z.boolean(),
  /** The privacy policy version the question was asked under (PRIVACY_VERSION). */
  version: z.string().trim().min(1).max(32),
});
export type AnalyticsConsentRequest = z.infer<typeof AnalyticsConsentRequest>;

export const AnalyticsConsentResponse = z.object({ ok: z.literal(true) });
export type AnalyticsConsentResponse = z.infer<typeof AnalyticsConsentResponse>;
