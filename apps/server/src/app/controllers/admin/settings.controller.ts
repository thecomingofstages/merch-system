/** /admin/settings (D22). PATCH, not PUT: the dashboard proxy forwards DELETE, GET, PATCH and POST only. */
import { Settings } from "@merch/shared";
import type { RequestHandler } from "express";
import * as settings from "../../helpers/settings.helper";
import { withModels } from "../../utils/models";

export const AdminSettingsController = {
  get: (async (req, res) => {
    res.json(await withModels(req, (m) => settings.getSettings(m)));
  }) satisfies RequestHandler,

  save: (async (req, res) => {
    const body = Settings.parse(req.body);
    res.json(await withModels(req, (m) => settings.saveSettings(m, body)));
  }) satisfies RequestHandler,
};
