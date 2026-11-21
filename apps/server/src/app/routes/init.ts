/**
 * Mounts every route file (the paths in docs/BACKEND.md "API").
 * One file per domain: add it here when its task lands.
 */
import { Router } from "express";
import { Auth } from "../middleware/Auth";
import { addressRoute } from "./address.route";
import { analyticsRoute } from "./analytics.route";
import { adminAnalyticsRoute } from "./admin/analytics.route";
import { adminCatalogRoute } from "./admin/catalog.route";
import { adminImageRoute } from "./admin/image.route";
import { adminOrderRoute } from "./admin/order.route";
import { adminPosRoute } from "./admin/pos.route";
import { adminPromotionRoute } from "./admin/promotion.route";
import { authRoute } from "./auth.route";
import { healthRoute } from "./health.route";
import { orderRoute } from "./order.route";
import { posRoute } from "./pos.route";
import { publicRoute } from "./public.route";

export function initRoutes(): Router {
  const api = Router();

  api.use(healthRoute);
  api.use(publicRoute);
  api.use(addressRoute);
  api.use(authRoute);
  api.use(orderRoute);
  api.use(analyticsRoute);
  api.use(posRoute);

  // Admin (F6): every /admin/* path needs ADMIN_ACCESS_TOKEN, even ones that do not exist.
  // Admin routers mount after Auth (S2, S7, S8).
  api.use("/admin", Auth);
  api.use("/admin", adminCatalogRoute);
  api.use("/admin", adminImageRoute);
  api.use("/admin", adminOrderRoute);
  api.use("/admin", adminPosRoute);
  api.use("/admin", adminPromotionRoute);
  api.use("/admin", adminAnalyticsRoute);

  return api;
}
