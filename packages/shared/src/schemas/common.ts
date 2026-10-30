import { z } from "zod";

/** A MongoDB ObjectId as a 24-character hex string. */
export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "must be an id");

/** Money is whole baht (AGENTS.md "Money"). */
export const baht = z.number().int().min(0);

/** A count of items: a whole number, at least 1. */
export const count = z.number().int().min(1);
