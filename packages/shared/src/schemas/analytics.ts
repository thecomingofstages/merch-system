import { z } from "zod";
import { objectId } from "./common";

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

// Usage statistics (D21): a funnel per product, as hits, sessions and visitors.

/** The funnel, in order: a card seen, the product opened, added to the cart, checkout reached, ordered. */
export const ANALYTICS_STEPS = ["impression", "view", "add_to_cart", "checkout", "purchase"] as const;
export const AnalyticsStep = z.enum(ANALYTICS_STEPS);
export type AnalyticsStep = z.infer<typeof AnalyticsStep>;

/** POST /analytics/events: what the shop sends, in small batches, only after a recorded yes. */
export const AnalyticsEventsRequest = z.object({
  visitor_id: z.string().uuid(),
  /** A new one after 30 minutes without activity. */
  session_id: z.string().uuid(),
  events: z.array(z.object({ type: AnalyticsStep, product_id: objectId })).min(1).max(50),
});
export type AnalyticsEventsRequest = z.infer<typeof AnalyticsEventsRequest>;

/** A day as the shop counts it (Thailand time), e.g. "2026-11-21". */
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

/** GET /admin/analytics and /admin/analytics/daily: both days included; leave out for no limit. */
export const AnalyticsRange = z.object({ from: Day.optional(), to: Day.optional() });
export type AnalyticsRange = z.infer<typeof AnalyticsRange>;

/** One step counted three ways (STAT lecture: hits double-count reloads, sessions and visitors don't). */
export const AnalyticsCounts = z.object({ hits: z.number().int(), sessions: z.number().int(), visitors: z.number().int() });
export type AnalyticsCounts = z.infer<typeof AnalyticsCounts>;
const Steps = z.object(Object.fromEntries(ANALYTICS_STEPS.map((s) => [s, AnalyticsCounts])) as Record<AnalyticsStep, typeof AnalyticsCounts>);

export const AnalyticsSummaryResponse = z.object({
  /** Everyone and every visit in the range, and the visits labelled isPurchased (an order was placed). */
  totals: z.object({ visitors: z.number().int(), sessions: z.number().int(), purchased_sessions: z.number().int() }),
  products: z.array(z.object({ product_id: objectId, product_name: z.string() }).and(Steps)),
});
export type AnalyticsSummaryResponse = z.infer<typeof AnalyticsSummaryResponse>;

export const AnalyticsDailyResponse = z.object({ days: z.array(z.object({ date: Day }).and(Steps)) });
export type AnalyticsDailyResponse = z.infer<typeof AnalyticsDailyResponse>;

/** DELETE /admin/analytics?before=YYYY-MM-DD (or every event when left out). */
export const AnalyticsDeleteResponse = z.object({ deleted: z.number().int() });
export type AnalyticsDeleteResponse = z.infer<typeof AnalyticsDeleteResponse>;
