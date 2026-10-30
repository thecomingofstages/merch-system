/** /admin/shops and /admin/products (S2). Bodies are checked with the @merch/shared schemas. */
import { ProductPatch, ProductRequest, ShopRequest, StockRequest, VariantPatch, VariantRequest } from "@merch/shared";
import type { RequestHandler } from "express";
import * as catalog from "../../helpers/catalog.helper";
import { idParam } from "../../utils/id";
import { withModels } from "../../utils/models";

const includeArchived = (q: unknown) => q === "true";

export const AdminCatalogController = {
  listShops: (async (req, res) => {
    res.json(await withModels(req, (m) => catalog.listShops(m, includeArchived(req.query.archived))));
  }) satisfies RequestHandler,

  createShop: (async (req, res) => {
    const body = ShopRequest.parse(req.body);
    res.status(201).json(await withModels(req, (m) => catalog.createShop(m, body)));
  }) satisfies RequestHandler,

  updateShop: (async (req, res) => {
    const id = idParam(req.params.id);
    const body = ShopRequest.parse(req.body);
    res.json(await withModels(req, (m) => catalog.updateShop(m, id, body)));
  }) satisfies RequestHandler,

  archiveShop: (async (req, res) => {
    const id = idParam(req.params.id);
    await withModels(req, (m) => catalog.archiveShop(m, id));
    res.status(204).end();
  }) satisfies RequestHandler,

  listProducts: (async (req, res) => {
    const shop_id = typeof req.query.shop_id === "string" ? idParam(req.query.shop_id) : undefined;
    res.json(await withModels(req, (m) => catalog.listProducts(m, { shop_id, includeArchived: includeArchived(req.query.archived) })));
  }) satisfies RequestHandler,

  getProduct: (async (req, res) => {
    const id = idParam(req.params.id);
    res.json(await withModels(req, (m) => catalog.getProduct(m, id)));
  }) satisfies RequestHandler,

  createProduct: (async (req, res) => {
    const body = ProductRequest.parse(req.body);
    res.status(201).json(await withModels(req, (m) => catalog.createProduct(m, body)));
  }) satisfies RequestHandler,

  updateProduct: (async (req, res) => {
    const id = idParam(req.params.id);
    const body = ProductPatch.parse(req.body);
    res.json(await withModels(req, (m) => catalog.updateProduct(m, id, body)));
  }) satisfies RequestHandler,

  archiveProduct: (async (req, res) => {
    const id = idParam(req.params.id);
    await withModels(req, (m) => catalog.archiveProduct(m, id));
    res.status(204).end();
  }) satisfies RequestHandler,

  addVariant: (async (req, res) => {
    const id = idParam(req.params.id);
    const body = VariantRequest.parse(req.body);
    res.status(201).json(await withModels(req, (m) => catalog.addVariant(m, id, body)));
  }) satisfies RequestHandler,

  updateVariant: (async (req, res) => {
    const id = idParam(req.params.id);
    const vid = idParam(req.params.vid);
    const body = VariantPatch.parse(req.body);
    res.json(await withModels(req, (m) => catalog.updateVariant(m, id, vid, body)));
  }) satisfies RequestHandler,

  archiveVariant: (async (req, res) => {
    const id = idParam(req.params.id);
    const vid = idParam(req.params.vid);
    await withModels(req, (m) => catalog.archiveVariant(m, id, vid));
    res.status(204).end();
  }) satisfies RequestHandler,

  addStock: (async (req, res) => {
    const id = idParam(req.params.id);
    const vid = idParam(req.params.vid);
    const { amount } = StockRequest.parse(req.body);
    res.json(await withModels(req, (m) => catalog.addStock(m, id, vid, amount)));
  }) satisfies RequestHandler,
};
