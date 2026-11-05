import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { SameOrigin, SameOriginJson, Session } from "../middleware/Session";

export const authRoute = Router();

authRoute.post("/auth/google", SameOriginJson, AuthController.google);
authRoute.post("/auth/logout", SameOrigin, AuthController.logout);
authRoute.get("/me", Session, AuthController.me);
