import { describe, expect, it } from "vitest";
import {
  InvalidWebhookSignatureError,
  OrderExpiredError,
  OrderNotFoundError,
  PaymentAmountMismatchError,
  WebhookEventConflictError,
} from "../../src/domain/errors/domain.error";
import { HmacWebhookSignatureVerifier } from "../../src/infrastructure/security/hmac-webhook-signature.verifier";
import { buildTestContext, createOpenAuction, HOUR_MS, TestContext, WEBHOOK_SECRET } from "../helpers/context";

/** An auction that closed with a winner ("ana", 100.000 COP) and therefore has a pending order. */
const closedAuctionWithOrder = async (ctx: TestContext) => {
  const auction = await createOpenAuction(ctx, { hours: 2 });
  await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 });
  ctx.clock.advance(3 * HOUR_MS);
  await ctx.auctionService.getAuctionById(auction.id);
  const order = await ctx.orderRepository.findByAuctionId(auction.id);
  if (order === null) {
    throw new Error("test setup failed: the order was not created");
  }
  return { auction, order };
};

const payload = (orderId: string, overrides: Partial<{ eventId: string; amount: number; status: "SUCCESS" | "FAILED" }> = {}) => ({
  eventId: overrides.eventId ?? "evt-1",
  orderId,
  amount: overrides.amount ?? 100_000,
  status: overrides.status ?? "SUCCESS",
});

describe("Payment webhook: RN-17 (only the webhook pays)", () => {
  it("a new order is PENDING and nothing in the platform marks it paid by itself", async () => {
    const ctx = buildTestContext();
    const { auction, order } = await closedAuctionWithOrder(ctx);

    // Reading auctions/orders many times, even by the winner, never changes it.
    await ctx.auctionService.getAuctionById(auction.id);
    await ctx.orderService.getOrderById(order.id, "ana");
    await ctx.orderService.listMyOrders("ana");

    expect((await ctx.orderRepository.findById(order.id))?.status).toBe("PENDING");
  });

  it("a SUCCESS notification marks the order as PAID", async () => {
    const ctx = buildTestContext();
    const { order } = await closedAuctionWithOrder(ctx);

    const result = await ctx.webhookService.handlePaymentWebhook(payload(order.id));

    expect(result).toEqual({ processed: true, orderId: order.id, orderStatus: "PAID" });
    const stored = await ctx.orderRepository.findById(order.id);
    expect(stored?.status).toBe("PAID");
    expect(stored?.paidAt).not.toBeNull();
  });

  it("a FAILED notification is recorded but the order stays PENDING and payable", async () => {
    const ctx = buildTestContext();
    const { order } = await closedAuctionWithOrder(ctx);

    const failed = await ctx.webhookService.handlePaymentWebhook(payload(order.id, { eventId: "evt-failed", status: "FAILED" }));
    expect(failed.orderStatus).toBe("PENDING");

    const retry = await ctx.webhookService.handlePaymentWebhook(payload(order.id, { eventId: "evt-retry" }));
    expect(retry.orderStatus).toBe("PAID");
  });
});

describe("Payment webhook: RN-18 (authenticity)", () => {
  const body = Buffer.from('{"event_id":"evt-1","order_id":"o1","amount":100000,"status":"SUCCESS"}');

  it("accepts a correct signature (with or without the sha256= prefix)", () => {
    const ctx = buildTestContext();
    const signature = HmacWebhookSignatureVerifier.sign(WEBHOOK_SECRET, body);

    expect(() => ctx.webhookService.assertAuthentic(body, signature)).not.toThrow();
    expect(() => ctx.webhookService.assertAuthentic(body, signature.replace("sha256=", ""))).not.toThrow();
  });

  it("rejects a missing, wrong or foreign signature", () => {
    const ctx = buildTestContext();
    const foreign = HmacWebhookSignatureVerifier.sign("another-secret-entirely", body);

    expect(() => ctx.webhookService.assertAuthentic(body, undefined)).toThrow(InvalidWebhookSignatureError);
    expect(() => ctx.webhookService.assertAuthentic(body, "")).toThrow(InvalidWebhookSignatureError);
    expect(() => ctx.webhookService.assertAuthentic(body, "sha256=abc")).toThrow(InvalidWebhookSignatureError);
    expect(() => ctx.webhookService.assertAuthentic(body, foreign)).toThrow(InvalidWebhookSignatureError);
  });

  it("rejects a valid signature of a DIFFERENT body (tampering)", () => {
    const ctx = buildTestContext();
    const signature = HmacWebhookSignatureVerifier.sign(WEBHOOK_SECRET, body);
    const tampered = Buffer.from('{"event_id":"evt-1","order_id":"o1","amount":1,"status":"SUCCESS"}');

    expect(() => ctx.webhookService.assertAuthentic(tampered, signature)).toThrow(InvalidWebhookSignatureError);
  });
});

describe("Payment webhook: RN-19 (idempotency)", () => {
  it("a repeated event returns the identical response and changes nothing", async () => {
    const ctx = buildTestContext();
    const { order } = await closedAuctionWithOrder(ctx);

    const first = await ctx.webhookService.handlePaymentWebhook(payload(order.id));
    const paidAt = (await ctx.orderRepository.findById(order.id))?.paidAt;
    ctx.clock.advance(HOUR_MS);
    const second = await ctx.webhookService.handlePaymentWebhook(payload(order.id));

    expect(second).toEqual(first);
    expect((await ctx.orderRepository.findById(order.id))?.paidAt).toEqual(paidAt); // not re-paid
    expect(ctx.webhookEventRepository.count()).toBe(1);
  });

  it("simultaneous identical notifications are processed once", async () => {
    const ctx = buildTestContext();
    const { order } = await closedAuctionWithOrder(ctx);

    const results = await Promise.all([1, 2, 3, 4].map(() => ctx.webhookService.handlePaymentWebhook(payload(order.id))));

    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(ctx.webhookEventRepository.count()).toBe(1);
  });

  it("a NEW event for an already paid order does not change it", async () => {
    const ctx = buildTestContext();
    const { order } = await closedAuctionWithOrder(ctx);
    await ctx.webhookService.handlePaymentWebhook(payload(order.id));
    const paidAt = (await ctx.orderRepository.findById(order.id))?.paidAt;

    ctx.clock.advance(HOUR_MS);
    const again = await ctx.webhookService.handlePaymentWebhook(payload(order.id, { eventId: "evt-2" }));

    expect(again.orderStatus).toBe("PAID");
    expect((await ctx.orderRepository.findById(order.id))?.paidAt).toEqual(paidAt);
  });

  it("refuses an event id reused for another order", async () => {
    const ctx = buildTestContext();
    const { order } = await closedAuctionWithOrder(ctx);
    await ctx.webhookService.handlePaymentWebhook(payload(order.id));

    await expect(ctx.webhookService.handlePaymentWebhook(payload("other-order"))).rejects.toThrow(WebhookEventConflictError);
  });
});

describe("Payment webhook: rejections leave the state untouched", () => {
  it("unknown order", async () => {
    const ctx = buildTestContext();
    await expect(ctx.webhookService.handlePaymentWebhook(payload("ghost"))).rejects.toThrow(OrderNotFoundError);
    expect(ctx.webhookEventRepository.count()).toBe(0);
  });

  it("amount different from the order amount", async () => {
    const ctx = buildTestContext();
    const { order } = await closedAuctionWithOrder(ctx);

    await expect(ctx.webhookService.handlePaymentWebhook(payload(order.id, { amount: 99_999 }))).rejects.toThrow(
      PaymentAmountMismatchError
    );
    expect((await ctx.orderRepository.findById(order.id))?.status).toBe("PENDING");
    expect(ctx.webhookEventRepository.count()).toBe(0);
  });

  it("RN-20: a payment after the 48h deadline is rejected and the auction is in BREACH", async () => {
    const ctx = buildTestContext();
    const { auction, order } = await closedAuctionWithOrder(ctx);
    ctx.clock.advance(50 * HOUR_MS);

    await expect(ctx.webhookService.handlePaymentWebhook(payload(order.id))).rejects.toThrow(OrderExpiredError);

    expect((await ctx.orderRepository.findById(order.id))?.status).toBe("EXPIRED");
    expect((await ctx.auctionRepository.findById(auction.id))?.status).toBe("BREACH");
  });
});
