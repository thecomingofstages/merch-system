import { Router } from "express";
import { AdminPromotionController as C } from "../../controllers/admin/promotion.controller";

/** Mounted under /admin, after Auth (routes/init.ts). */
export const adminPromotionRoute = Router();

adminPromotionRoute.get("/promotions", C.list);
adminPromotionRoute.post("/promotions", C.create);
adminPromotionRoute.patch("/promotions/:id", C.update);
adminPromotionRoute.delete("/promotions/:id", C.archive);
