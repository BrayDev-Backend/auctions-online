import { createHmac, timingSafeEqual } from "node:crypto";
import { IWebhookSignatureVerifier } from "../../domain/ports/webhook-signature.port";

const PREFIX = "sha256=";

/**
 * HMAC-SHA256 adapter for IWebhookSignatureVerifier (RN-18).
 *
 * The gateway signs the EXACT raw body with the shared WEBHOOK_SECRET and sends
 *   X-Signature: sha256=<hex digest>
 * (the "sha256=" prefix is optional).
 */
export class HmacWebhookSignatureVerifier implements IWebhookSignatureVerifier {
  constructor(private readonly secret: string) {}

  /** Used by the gateway side / simulator to sign a body. */
  static sign(secret: string, rawBody: Uint8Array): string {
    return `${PREFIX}${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  }

  verify(rawBody: Uint8Array, signature: string | undefined): boolean {
    if (signature === undefined || signature.length === 0) {
      return false;
    }

    const received = Buffer.from(signature.startsWith(PREFIX) ? signature.slice(PREFIX.length) : signature, "utf8");
    const expected = Buffer.from(createHmac("sha256", this.secret).update(rawBody).digest("hex"), "utf8");

    // timingSafeEqual throws on different lengths, and a plain === would leak timing information.
    return received.length === expected.length && timingSafeEqual(received, expected);
  }
}
