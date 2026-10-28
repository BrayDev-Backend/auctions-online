/**
 * Errors produced by the APPLICATION layer (HTTP concerns: malformed input,
 * missing token, unknown route). Business errors live in domain/errors.
 */
export abstract class ApplicationError extends Error {
  abstract readonly errorCode: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ApplicationError {
  readonly errorCode = "VALIDATION_ERROR";
  readonly statusCode = 400;
}

export class UnauthorizedError extends ApplicationError {
  readonly errorCode = "UNAUTHORIZED";
  readonly statusCode = 401;
}

export class RouteNotFoundError extends ApplicationError {
  readonly errorCode = "ROUTE_NOT_FOUND";
  readonly statusCode = 404;
}
