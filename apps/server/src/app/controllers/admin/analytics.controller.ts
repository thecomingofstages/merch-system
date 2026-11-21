/** /admin/analytics (D21): the usage-statistics funnel, its daily trend, and deleting it. */
import { AnalyticsRange } from "@merch/shared";
import type { RequestHandler } from "express";
import { z } from "zod";
import * as analytics from "../../helpers/analytics.helper";
import { idParam } from "../../utils/id";
import { withModels } from "../../utils/models";

const DeleteQuery = z.object({ before: AnalyticsRange.shape.from });

export const AdminAnalyticsController = {
  summary: (async (req, res) => {
    const range = AnalyticsRange.parse(req.query);
    res.json(await withModels(req, (m) => analytics.summary(m, range)));
  }) satisfies RequestHandler,

  daily: (async (req, res) => {
    const id = idParam(req.params.productId);
    const range = AnalyticsRange.parse(req.query);
    res.json(await withModels(req, (m) => analytics.daily(m, id, range)));
  }) satisfies RequestHandler,

  delete: (async (req, res) => {
    const { before } = DeleteQuery.parse(req.query);
    res.json(await withModels(req, (m) => analytics.deleteEvents(m, before)));
  }) satisfies RequestHandler,
};
