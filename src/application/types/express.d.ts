import { IAuthTokenPayload } from "../../domain/ports/token-service.port";

/**
 * Adds `req.auth` to Express' Request type. It is filled by the auth
 * middleware after a valid JWT is verified.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: IAuthTokenPayload;
    }
  }
}

export {};
