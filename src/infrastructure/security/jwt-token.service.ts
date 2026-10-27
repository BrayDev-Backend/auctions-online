import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { InvalidTokenError } from "../../domain/errors/domain.error";
import { IAuthTokenPayload, ITokenService } from "../../domain/ports/token-service.port";

const ALGORITHM = "HS256";

/**
 * JWT adapter (library: jsonwebtoken) for the ITokenService port.
 * Token claims: `sub` = user id (standard JWT claim) and `email`.
 */
export class JwtTokenService implements ITokenService {
  private readonly expiresIn: SignOptions["expiresIn"];

  /**
   * @param expiresIn "3600" (seconds), "15m", "1h", "7d"... (format validated in config/env.ts).
   *   A plain-digits string is converted to a NUMBER of seconds because
   *   jsonwebtoken reads the STRING "3600" as 3600 milliseconds.
   */
  constructor(
    private readonly secret: string,
    expiresIn: string | number
  ) {
    this.expiresIn = (/^\d+$/.test(String(expiresIn)) ? Number(expiresIn) : expiresIn) as SignOptions["expiresIn"];
  }

  issue(payload: IAuthTokenPayload): string {
    return jwt.sign({ email: payload.email }, this.secret, {
      subject: payload.userId,
      expiresIn: this.expiresIn,
      algorithm: ALGORITHM,
    });
  }

  verify(token: string): IAuthTokenPayload {
    let decoded: string | JwtPayload;
    try {
      // Pinning the algorithm prevents "alg: none" / algorithm-confusion attacks.
      decoded = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] });
    } catch {
      throw new InvalidTokenError("The access token is invalid or has expired.");
    }

    if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded["email"] !== "string") {
      throw new InvalidTokenError("The access token has an unexpected format.");
    }
    return { userId: decoded.sub, email: decoded["email"] };
  }
}
