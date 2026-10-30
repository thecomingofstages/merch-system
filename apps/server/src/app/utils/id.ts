import { isValidObjectId, Types } from "mongoose";
import { ApiError } from "./ApiError";

/** A route parameter as an ObjectId; a malformed id answers 404 like a missing one. */
export function idParam(value: unknown): Types.ObjectId {
  if (typeof value !== "string" || !isValidObjectId(value) || !/^[0-9a-f]{24}$/i.test(value)) throw ApiError.notFound();
  return new Types.ObjectId(value);
}
