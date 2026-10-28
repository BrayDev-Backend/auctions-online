import { NextFunction, Request, Response } from "express";
import { DomainError } from "../../domain/errors/domain.error";
import { ApplicationError, RouteNotFoundError } from "../errors/application.error";
import { logger } from "../../infrastructure/logger/console.logger";

interface ErrorBody {
  ok: false;
  error: { code: string; message: string };
}

/** Errors thrown by express.json() when the body is not valid JSON. */
const isBodyParserError = (err: unknown): err is { type: string; status: number } =>
  typeof err === "object" && err !== null && "type" in err && "status" in err && typeof err.status === "number";

const send = (res: Response, status: number, code: string, message: string): void => {
  const body: ErrorBody = { ok: false, error: { code, message } };
  res.status(status).json(body);
};

/** Catch-all for unknown routes (registered after every router). */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new RouteNotFoundError(`Route ${req.method} ${req.originalUrl} does not exist.`));
};

/**
 * Centralized error handler (RNF-12 / RNF-13). Every error leaves the API as:
 *   { "ok": false, "error": { "code": "...", "message": "..." } }
 * with a meaningful status code (never 200).
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof DomainError || err instanceof ApplicationError) {
    send(res, err.statusCode, err.errorCode, err.message);
    return;
  }

  if (isBodyParserError(err) && err.type === "entity.parse.failed") {
    send(res, 400, "INVALID_JSON", "The request body is not valid JSON.");
    return;
  }

  if (isBodyParserError(err) && err.status >= 400 && err.status < 500) {
    send(res, err.status, "BAD_REQUEST", err instanceof Error ? err.message : "Bad request.");
    return;
  }

  // Unexpected error: log everything (RNF-17), reveal nothing to the client.
  logger.error("Unhandled error", err);
  send(res, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred on the server.");
};