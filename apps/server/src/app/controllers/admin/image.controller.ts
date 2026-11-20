/** POST /admin/images (D17): one image from the dashboard, stored in R2. */
import type { ImageUploadResponse } from "@merch/shared";
import type { RequestHandler } from "express";
import { imageStore, putImage } from "../../helpers/images.helper";
import { ApiError } from "../../utils/ApiError";
import { getConfig } from "../../utils/config";

export const AdminImageController = {
  upload: (async (req, res) => {
    // express.raw fills req.body only for the image types it was given; anything else stays {}.
    if (!Buffer.isBuffer(req.body)) throw ApiError.validation("image: send the file as the body, with an image Content-Type");
    const url = await putImage(imageStore(getConfig(req)), req.body, req.get("content-type"));
    res.status(201).json({ url } satisfies ImageUploadResponse);
  }) satisfies RequestHandler,
};
