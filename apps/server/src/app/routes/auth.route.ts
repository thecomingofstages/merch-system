import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { SameOriginJson, Session } from "../middleware/Session";

export const authRoute = Router();

authRoute.post("/auth/google", SameOriginJson, AuthController.google);
authRoute.get("/me", Session, AuthController.me);
