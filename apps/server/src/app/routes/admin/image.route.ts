import express, { Router } from "express";
import { appConf } from "../../config/app.conf";
import { AdminImageController as C } from "../../controllers/admin/image.controller";
import { imageTypes } from "../../helpers/images.helper";

/** Mounted under /admin, after Auth (routes/init.ts). */
export const adminImageRoute = Router();

adminImageRoute.post("/images", express.raw({ type: imageTypes, limit: appConf.imageMaxBytes }), C.upload);
