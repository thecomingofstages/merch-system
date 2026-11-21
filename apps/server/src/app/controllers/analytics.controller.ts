/** POST /analytics/consent (D20): records a visitor's yes, or their later no. */
import { AnalyticsConsentRequest, type AnalyticsConsentResponse } from "@merch/shared";
import type { RequestHandler } from "express";
import { withModels } from "../utils/models";

export const AnalyticsController = {
  consent: (async (req, res) => {
    const { visitor_id, accepted, version } = AnalyticsConsentRequest.parse(req.body);
    const now = new Date();
    await withModels(req, (m) =>
      m.AnalyticsConsent.updateOne(
        { visitor_id },
        { $set: { accepted, version, ...(accepted ? { accepted_at: now, withdrawn_at: null } : { withdrawn_at: now }) } },
        { upsert: true },
      ),
    );
    res.json({ ok: true } satisfies AnalyticsConsentResponse);
  }) satisfies RequestHandler,
};
