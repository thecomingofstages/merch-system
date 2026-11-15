import { Router } from "express";
import { AddressController } from "../controllers/address.controller";

export const addressRoute = Router();

addressRoute.get("/address/postcode/:code", AddressController.postcode);
