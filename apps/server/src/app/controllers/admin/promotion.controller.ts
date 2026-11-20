/** /admin/promotions (D13). Bodies are checked with the @merch/shared schema. */
import { PromotionRequest } from "@merch/shared";
import type { RequestHandler } from "express";
import * as promotion from "../../helpers/promotion.helper";
import { idParam } from "../../utils/id";
import { imageStore } from "../../helpers/images.helper";
import { getConfig } from "../../utils/config";
import { withModels } from "../../utils/models";

export const AdminPromotionController = {
  list: (async (req, res) => {
    res.json(await withModels(req, promotion.listPromotions));
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const body = PromotionRequest.parse(req.body);
    res.status(201).json(await withModels(req, (m) => promotion.createPromotion(m, imageStore(getConfig(req)), body)));
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    const id = idParam(req.params.id);
    const body = PromotionRequest.parse(req.body);
    res.json(await withModels(req, (m) => promotion.updatePromotion(m, imageStore(getConfig(req)), id, body)));
  }) satisfies RequestHandler,

  archive: (async (req, res) => {
    const id = idParam(req.params.id);
    await withModels(req, (m) => promotion.archivePromotion(m, imageStore(getConfig(req)), id));
    res.status(204).end();
  }) satisfies RequestHandler,
};
