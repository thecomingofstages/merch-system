import { Router } from "express";
import { AdminOrderController as C } from "../../controllers/admin/order.controller";

/** Mounted under /admin, after Auth (routes/init.ts). */
export const adminOrderRoute = Router();

adminOrderRoute.get("/orders", C.list);
adminOrderRoute.get("/orders/count", C.count);
adminOrderRoute.get("/orders/:id", C.get);
adminOrderRoute.patch("/orders/:id/payment", C.payment);
adminOrderRoute.patch("/orders/:id/tracking", C.tracking);
