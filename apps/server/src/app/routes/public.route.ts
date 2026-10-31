import { Router } from "express";
import { PublicController } from "../controllers/public.controller";

export const publicRoute = Router();

publicRoute.get("/catalog", PublicController.catalog);
publicRoute.post("/quote", PublicController.quote);
