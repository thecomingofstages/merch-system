/** POST /auth/google and GET /me (S6). */
import { GoogleAuthRequest } from "@merch/shared";
import type { RequestHandler } from "express";
import { appConf } from "../config/app.conf";
import { getMe, signIn, verifyGoogleToken } from "../helpers/auth.helper";
import { createSessionToken } from "../helpers/session.helper";
import { getConfig } from "../utils/config";
import { withModels } from "../utils/models";

export const AuthController = {
  google: (async (req, res) => {
    const { id_token } = GoogleAuthRequest.parse(req.body);
    const config = getConfig(req);
    const profile = await verifyGoogleToken(id_token, config.GOOGLE_CLIENT_ID);
    const { id, me } = await withModels(req, (m) => signIn(m, profile));
    res.cookie(appConf.sessionCookie, createSessionToken(id, config.SESSION_SECRET), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: appConf.sessionMaxAgeSeconds * 1000,
    });
    res.json(me);
  }) satisfies RequestHandler,

  me: (async (req, res) => {
    res.json(await withModels(req, (m) => getMe(m, res.locals.user_id)));
  }) satisfies RequestHandler,
};
