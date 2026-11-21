import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { SameOriginJson } from "../middleware/Session";

export const analyticsRoute = Router();

// Only the shop's own pages may record a consent (no cookie here, but no stranger's either).
analyticsRoute.post("/analytics/consent", SameOriginJson, AnalyticsController.consent);
analyticsRoute.post("/analytics/events", SameOriginJson, AnalyticsController.events);
