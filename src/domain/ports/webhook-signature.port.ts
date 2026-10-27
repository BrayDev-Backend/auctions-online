/**
 * OUTPUT PORT (RN-18) decides whether a webhook really comes from the payment
 * gateway the domain does not know HOW the adapter does
 *
 * rawBody are the exact bytes received signatures are computed over them
 * so they must NOT be re-serialized from parsed JSON
 */
export interface IWebhookSignatureVerifier {
  verify(rawBody: Uint8Array, signature: string | undefined): boolean;
}
