/**
 * The last middleware. Every error answer is `{ error: { code, message } }` (docs/BACKEND.md "API").
 * Unknown errors become a 500 with a generic message, so stack traces and
 * database details never reach the caller.
 */
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

export const NotFound: RequestHandler = (_req, _res, next) => next(ApiError.notFound());

export const ErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const send = (status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

  if (err instanceof ApiError) return send(err.status, err.code, err.message);
  // By shape too: @merch/shared and the server can each get their own copy of zod
  // (the root has zod 4 for eslint), and then instanceof fails across them.
  if (err instanceof ZodError || (err?.name === "ZodError" && Array.isArray(err.issues))) {
    const issue = err.issues[0];
    return send(400, "VALIDATION", issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request");
  }
  // From express.json().
  if (err?.type === "entity.parse.failed") return send(400, "VALIDATION", "Invalid JSON");
  if (err?.type === "entity.too.large") return send(413, "VALIDATION", "Request body too large");

  console.error("Unhandled error", { method: req.method, path: req.path, name: err?.name });
  return send(500, "INTERNAL", "Internal server error");
};
