import { Router } from "express";
import { PosController as C } from "../../controllers/pos.controller";

/** Mounted under /admin, after Auth (routes/init.ts). */
export const adminPosRoute = Router();

adminPosRoute.get("/pos", C.list);
adminPosRoute.post("/pos", C.create);
adminPosRoute.get("/pos/:id", C.get);
adminPosRoute.post("/pos/:id/transfer", C.transfer);
adminPosRoute.post("/pos/:id/end-sale", C.endSale);
