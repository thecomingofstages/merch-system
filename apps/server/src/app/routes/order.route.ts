import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { SameOriginJson, Session } from "../middleware/Session";

export const orderRoute = Router();

orderRoute.post("/orders", SameOriginJson, Session, OrderController.create);
