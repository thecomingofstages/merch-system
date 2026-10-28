import type { Request } from "express";
import type { Config } from "../config/init";

/** The checked config that buildApp stored on the app. */
export const getConfig = (req: Request) => req.app.locals.config as Config;
