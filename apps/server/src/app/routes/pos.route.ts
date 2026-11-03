import { Router } from "express";
import { PosController } from "../controllers/pos.controller";
import { Auth } from "../middleware/Auth";

export const posRoute = Router();

// The POS's own Next.js server adds ADMIN_ACCESS_TOKEN (D6, F7).
posRoute.post("/pos/:id/sales", Auth, PosController.sale);
