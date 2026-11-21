import { Router } from "express";
import { AdminAnalyticsController as C } from "../../controllers/admin/analytics.controller";

/** Mounted under /admin, after Auth (routes/init.ts). */
export const adminAnalyticsRoute = Router();

adminAnalyticsRoute.get("/analytics", C.summary);
adminAnalyticsRoute.get("/analytics/:productId/daily", C.daily);
adminAnalyticsRoute.delete("/analytics", C.delete);
