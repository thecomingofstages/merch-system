import type { RequestHandler } from "express";
import { lookupPostcode } from "../helpers/postcode.helper";

export const AddressController = {
  postcode: ((req, res) => {
    res.json(lookupPostcode(req.params.code));
  }) satisfies RequestHandler,
};
