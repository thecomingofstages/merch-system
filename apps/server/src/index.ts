/**
 * Bootstrap: config → app (middleware → routes) → listen, on Cloudflare Workers
 * through httpServerHandler (docs/BACKEND.md "Hosting").
 *
 * No database step here: Workers keep nothing between requests, so each request
 * opens its own connection (app/database/db.ts).
 */
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { initConfig } from "./app/config/init";
import { buildApp } from "./app/server";

const PORT = 3000; // only a label that links listen() to the handler

const config = initConfig(env as unknown as Record<string, unknown>);
buildApp(config).listen(PORT);

export default httpServerHandler({ port: PORT });
