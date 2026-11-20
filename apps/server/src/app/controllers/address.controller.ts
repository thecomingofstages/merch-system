import type { RequestHandler } from "express";
import { lookupPostcode } from "../helpers/postcode.helper";

export const AddressController = {
  postcode: (async (req, res) => {
    res.json(await lookupPostcode(req.params.code));
  }) satisfies RequestHandler,
};
