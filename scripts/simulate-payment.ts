/**
 * Payment gateway SIMULATOR. Sends a correctly SIGNED webhook to the running API,
 * so you can test the payment flow without a real gateway.
 *
 *   npm run webhook:simulate -- <order_id> <amount> [--status FAILED] [--event-id evt_1] [--bad-signature]
 *
 * Send the same --event-id twice to see the idempotent answer (RN-19);
 * use --bad-signature to see the rejection (RN-18).
 */
import "dotenv/config";
import { HmacWebhookSignatureVerifier } from "../src/infrastructure/security/hmac-webhook-signature.verifier";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const [orderId, amountText] = args.filter((arg, i) => !arg.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
if (!orderId || !amountText) {
  console.error("Usage: npm run webhook:simulate -- <order_id> <amount> [--status FAILED] [--event-id evt_1] [--bad-signature]");
  process.exit(1);
}

const secret = process.env["WEBHOOK_SECRET"];
if (!secret) {
  console.error("WEBHOOK_SECRET is not defined (check your .env).");
  process.exit(1);
}

const body = JSON.stringify({
  event_id: flag("event-id") ?? `evt_${Date.now()}`,
  order_id: orderId,
  amount: Number(amountText),
  status: flag("status") ?? "SUCCESS",
});

const signature = args.includes("--bad-signature")
  ? "sha256=0000000000000000000000000000000000000000000000000000000000000000"
  : HmacWebhookSignatureVerifier.sign(secret, Buffer.from(body, "utf8"));

const url = `http://localhost:${process.env["PORT"] ?? 3000}/api/v1/webhooks/payments`;

const main = async (): Promise<void> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signature },
    body,
  });
  console.log(`POST ${url}\n> ${body}\n< HTTP ${response.status}\n< ${await response.text()}`);
};

main().catch((error: unknown) => {
  console.error("Could not reach the API. Is it running?", error);
  process.exit(1);
});
