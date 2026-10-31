/**
 * Throw this anywhere to answer with a status and `{ error: { code, message } }`
 * (docs/BACKEND.md "API"). The message goes to the caller: never put secrets in it.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(message = "Unauthorized") { return new ApiError(401, "UNAUTHORIZED", message); }
  static validation(message: string) { return new ApiError(400, "VALIDATION", message); }
  static notFound(message = "Not found") { return new ApiError(404, "NOT_FOUND", message); }
  /** 409 with a code from docs/BACKEND.md "API", e.g. IN_USE, OUT_OF_STOCK, BUY_LIMIT. */
  static conflict(code: string, message: string) { return new ApiError(409, code, message); }
  static unavailable(message = "Service unavailable") { return new ApiError(503, "UNAVAILABLE", message); }
}
