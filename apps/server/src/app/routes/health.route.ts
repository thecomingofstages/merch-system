import { Router } from "express";
import { HealthController } from "../controllers/health.controller";

export const healthRoute = Router();

healthRoute.get("/health", HealthController.check);
