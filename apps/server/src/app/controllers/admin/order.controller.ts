/** /admin/orders (S7). */
import { AdminOrdersCountQuery, AdminOrdersQuery, UpdateOrderPaymentRequest, UpdateOrderTrackingRequest } from "@merch/shared";
import type { RequestHandler } from "express";
import * as orders from "../../helpers/adminOrder.helper";
import { getConfig } from "../../utils/config";
import { idParam } from "../../utils/id";
import { withModels } from "../../utils/models";

export const AdminOrderController = {
  list: (async (req, res) => {
    const query = AdminOrdersQuery.parse(req.query);
    res.json(await withModels(req, (m) => orders.listOrders(m, query)));
  }) satisfies RequestHandler,

  count: (async (req, res) => {
    const query = AdminOrdersCountQuery.parse(req.query);
    res.json(await withModels(req, (m) => orders.countOrders(m, query)));
  }) satisfies RequestHandler,

  get: (async (req, res) => {
    const id = idParam(req.params.id);
    res.json(await withModels(req, (m) => orders.getOrder(m, id)));
  }) satisfies RequestHandler,

  payment: (async (req, res) => {
    const id = idParam(req.params.id);
    const { payment_status } = UpdateOrderPaymentRequest.parse(req.body);
    res.json(await withModels(req, (m, db) => orders.setPayment(m, db, id, payment_status)));
  }) satisfies RequestHandler,

  tracking: (async (req, res) => {
    const id = idParam(req.params.id);
    const { tracking_id } = UpdateOrderTrackingRequest.parse(req.body);
    res.json(await withModels(req, (m) => orders.setTracking(m, id, tracking_id, getConfig(req))));
  }) satisfies RequestHandler,
};
