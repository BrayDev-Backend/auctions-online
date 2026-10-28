import { NextFunction, Request, RequestHandler, Response } from "express";
import { IAuthTokenPayload, ITokenService } from "../../domain/ports/token-service.port";
import { UnauthorizedError } from "../errors/application.error";

/**
 * JWT authentication middleware.
 * Expects the header:  Authorization: Bearer <token>
 * On success, `req.auth = { userId, email }`. Otherwise -> 401.
 */
export const createAuthMiddleware = (tokenService: ITokenService): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (header === undefined) {
      throw new UnauthorizedError("Missing Authorization header (expected: Bearer <token>).");
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || token === undefined || token.length === 0) {
      throw new UnauthorizedError("Malformed Authorization header (expected: Bearer <token>).");
    }

    // Throws InvalidTokenError (401) when invalid/expired; the error middleware formats it.
    req.auth = tokenService.verify(token);
    next();
  };
};

/** Returns the authenticated user id (only call it on routes protected by the auth middleware). */
export const getAuthUserId = (req: { auth?: IAuthTokenPayload }): string => {
  if (req.auth === undefined) {
    throw new UnauthorizedError("Authentication required.");
  }
  return req.auth.userId;
};
