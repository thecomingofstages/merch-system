/** Routes anyone can call: the catalog (S3) and the quote (S4). */
import { QuoteRequest, type QuoteResponse } from "@merch/shared";
import type { RequestHandler } from "express";
import { getCatalog } from "../helpers/catalog.helper";
import { priceCart } from "../helpers/pricing.helper";
import { getConfig } from "../utils/config";
import { withModels } from "../utils/models";

export const PublicController = {
  catalog: (async (req, res) => {
    res.json(await withModels(req, getCatalog));
  }) satisfies RequestHandler,

  /** POST /quote: amounts from the database only; the QR uses `total` (business rule 1). */
  quote: (async (req, res) => {
    const body = QuoteRequest.parse(req.body);
    const config = getConfig(req);
    const priced = await withModels(req, (m) => priceCart(m, body, config));
    res.json({ ...priced, promptpay_id: config.PROMPTPAY_ID } satisfies QuoteResponse);
  }) satisfies RequestHandler,
};
