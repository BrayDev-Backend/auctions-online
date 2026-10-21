/** Data carried inside an access token */
export interface IAuthTokenPayload {
  userId: string;
  email: string;
}

/** OUTPUT PORT: access tokens implemented with JWT (jsonwebtoken) in infrastructure */
export interface ITokenService {
  issue(payload: IAuthTokenPayload): string;
  /** throws InvalidTokenError when the token is invalid or expired */
  verify(token: string): IAuthTokenPayload;
}
