/** POST /orders (S5). From sprint 2 it needs the buyer's session (S6). */
import { CreateOrderRequest } from "@merch/shared";
import type { RequestHandler } from "express";
import { createOrder } from "../helpers/order.helper";
import { getConfig } from "../utils/config";
import { withModels } from "../utils/models";

export const OrderController = {
  create: (async (req, res) => {
    const body = CreateOrderRequest.parse(req.body);
    const config = getConfig(req);
    res.status(201).json(await withModels(req, (m, db) => createOrder(m, db, body, config)));
  }) satisfies RequestHandler,
};
