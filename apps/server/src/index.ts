/**
 * Worker entry point (docs/BACKEND.md "Hosting"): the Express app runs on
 * Cloudflare Workers through httpServerHandler.
 *
 * No database step here: Workers keep nothing between requests, so each request
 * opens its own connection (db.ts).
 */
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { buildApp } from "./app";
import { readEnv } from "./env";

const PORT = 3000; // only a label that links listen() to the handler

buildApp(readEnv(env as unknown as Record<string, unknown>)).listen(PORT);

export default httpServerHandler({ port: PORT });
