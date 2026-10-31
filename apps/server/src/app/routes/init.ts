/**
 * Mounts every route file (the paths in docs/BACKEND.md "API").
 * One file per domain: add it here when its task lands.
 */
import { Router } from "express";
import { Auth } from "../middleware/Auth";
import { adminCatalogRoute } from "./admin/catalog.route";
import { healthRoute } from "./health.route";
import { publicRoute } from "./public.route";

export function initRoutes(): Router {
  const api = Router();

  api.use(healthRoute);
  api.use(publicRoute);

  // Admin (F6): every /admin/* path needs ADMIN_ACCESS_TOKEN, even ones that do not exist.
  // Admin routers mount after Auth (S2, S7, S8).
  api.use("/admin", Auth);
  api.use("/admin", adminCatalogRoute);

  return api;
}
