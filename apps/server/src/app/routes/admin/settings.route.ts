import { Router } from "express";
import { AdminSettingsController as C } from "../../controllers/admin/settings.controller";

/** Mounted under /admin, after Auth (routes/init.ts). */
export const adminSettingsRoute = Router();

adminSettingsRoute.get("/settings", C.get);
adminSettingsRoute.patch("/settings", C.save);
