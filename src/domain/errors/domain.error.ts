/**
Base class for every business-rule violation
 
The domain only knows "what went wrong" (code + message + a suggested HTTP-like
status). It does not know about Express; the error middleware transjlates it.
 */
export abstract class DomainError extends Error {
  abstract readonly errorCode: string;
  readonly statusCode: number = 400;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------- Value objects ----------

export class InvalidMoneyError extends DomainError {
  readonly errorCode = "INVALID_MONEY";
}

export class InvalidEmailError extends DomainError {
  readonly errorCode = "INVALID_EMAIL";
}

// ---------- Auctions ----------

/** RN-01: missing or invalid required auction data. */
export class InvalidAuctionDataError extends DomainError {
  readonly errorCode = "INVALID_AUCTION_DATA";
}

/** RN-02: closing date must be in the future. */
export class InvalidClosingDateError extends DomainError {
  readonly errorCode = "INVALID_CLOSING_DATE";
}

/** RN-03: duration between 1 hour and 30 days. */
export class InvalidAuctionDurationError extends DomainError {
  readonly errorCode = "INVALID_AUCTION_DURATION";
}

export class AuctionNotFoundError extends DomainError {
  readonly errorCode = "AUCTION_NOT_FOUND";
  override readonly statusCode = 404;
}

export class NotAuctionOwnerError extends DomainError {
  readonly errorCode = "NOT_AUCTION_OWNER";
  override readonly statusCode = 403;
}

/** RN-04: only cancellable while open and without bids. */
export class AuctionCannotBeCanceledError extends DomainError {
  readonly errorCode = "AUCTION_CANNOT_BE_CANCELED";
}

// ---------- Bids ----------

/** RN-06 */
export class AuctionNotOpenError extends DomainError {
  readonly errorCode = "AUCTION_NOT_OPEN";
}

/** RN-07 */
export class SelfBidError extends DomainError {
  readonly errorCode = "SELF_BID_NOT_ALLOWED";
}

/** RN-08 */
export class BidBelowBasePriceError extends DomainError {
  readonly errorCode = "BID_BELOW_BASE_PRICE";
}

/** RN-09 */
export class BidIncrementTooLowError extends DomainError {
  readonly errorCode = "BID_INCREMENT_TOO_LOW";
}

/** RN-10 */
export class SelfOutbidError extends DomainError {
  readonly errorCode = "SELF_OUTBID_NOT_ALLOWED";
}

// ---------- Users / Auth ----------

/** RN-22 */
export class EmailAlreadyInUseError extends DomainError {
  readonly errorCode = "EMAIL_ALREADY_IN_USE";
  override readonly statusCode = 409;
}

export class InvalidCredentialsError extends DomainError {
  readonly errorCode = "INVALID_CREDENTIALS";
  override readonly statusCode = 401;
}

export class InvalidTokenError extends DomainError {
  readonly errorCode = "INVALID_TOKEN";
  override readonly statusCode = 401;
}

export class UserNotFoundError extends DomainError {
  readonly errorCode = "USER_NOT_FOUND";
  override readonly statusCode = 404;
}

// ---------- Orders ----------

export class OrderNotFoundError extends DomainError {
  readonly errorCode = "ORDER_NOT_FOUND";
  override readonly statusCode = 404;
}

export class OrderAccessDeniedError extends DomainError {
  readonly errorCode = "ORDER_ACCESS_DENIED";
  override readonly statusCode = 403;
}
