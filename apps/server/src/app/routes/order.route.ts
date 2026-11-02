import { Router } from "express";
import { OrderController } from "../controllers/order.controller";

export const orderRoute = Router();

orderRoute.post("/orders", OrderController.create);
