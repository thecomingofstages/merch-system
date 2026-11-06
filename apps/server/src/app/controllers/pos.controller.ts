/** /admin/pos (S8) and /pos/:id/sales (S9). */
import { CreatePosRequest, CreatePosSaleRequest, TransferRequest } from "@merch/shared";
import type { RequestHandler } from "express";
import * as pos from "../helpers/pos.helper";
import { getConfig } from "../utils/config";
import { idParam } from "../utils/id";
import { withModels } from "../utils/models";

export const PosController = {
  list: (async (req, res) => {
    res.json(await withModels(req, pos.listPos));
  }) satisfies RequestHandler,

  get: (async (req, res) => {
    const id = idParam(req.params.id);
    res.json(await withModels(req, (m) => pos.getPos(m, id)));
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const body = CreatePosRequest.parse(req.body);
    res.status(201).json(await withModels(req, (m) => pos.createPos(m, body)));
  }) satisfies RequestHandler,

  transfer: (async (req, res) => {
    const id = idParam(req.params.id);
    const body = TransferRequest.parse(req.body);
    res.json(await withModels(req, (m, db) => pos.transfer(m, db, id, body)));
  }) satisfies RequestHandler,

  endSale: (async (req, res) => {
    const id = idParam(req.params.id);
    res.json(await withModels(req, (m, db) => pos.endSale(m, db, id)));
  }) satisfies RequestHandler,

  sale: (async (req, res) => {
    const id = idParam(req.params.id);
    const body = CreatePosSaleRequest.parse(req.body);
    const config = getConfig(req);
    res.status(201).json(await withModels(req, (m, db) => pos.createSale(m, db, id, body, config)));
  }) satisfies RequestHandler,
};
