import {
  InvalidWebhookSignatureError,
  OrderNotFoundError,
  PaymentAmountMismatchError,
  WebhookEventConflictError,
} from "../errors/domain.error";
import { IAuctionRepository } from "../ports/auction.repository.port";
import { IOrderRepository } from "../ports/order.repository.port";
import { IClock } from "../ports/system.port";
import {
  IProcessedWebhookEvent,
  IWebhookEventRepository,
  PaymentNotificationStatus,
} from "../ports/webhook-event.repository.port";
import { IWebhookSignatureVerifier } from "../ports/webhook-signature.port";
import { KeyedMutex } from "../shared/keyed-mutex";
import { OrderStatus } from "../value-objects/order-status.vo";
import { AuctionSettlement } from "./auction-settlement.service";

export interface IPaymentWebhookPayload {
  /** Unique id of the notification, assigned by the payment gateway. */
  eventId: string;
  orderId: string;
  amount: number;
  status: PaymentNotificationStatus;
}

export interface IPaymentWebhookResult {
  processed: true;
  orderId: string;
  orderStatus: OrderStatus;
}

export interface IWebhookServiceDeps {
  signatureVerifier: IWebhookSignatureVerifier;
  webhookEventRepository: IWebhookEventRepository;
  orderRepository: IOrderRepository;
  auctionRepository: IAuctionRepository;
  settlement: AuctionSettlement;
  auctionLock: KeyedMutex;
  clock: IClock;
}

/**
 * Payment webhook use cases.
 *  - RN-17: the only place where an order becomes PAGADA.
 *  - RN-18: unauthenticated notifications are rejected before touching anything.
 *  - RN-19: idempotent — a repeated event_id returns the identical response.
 */
export const createWebhookService = (deps: IWebhookServiceDeps) => {
  const { signatureVerifier, webhookEventRepository, orderRepository, auctionRepository, settlement, auctionLock, clock } =
    deps;

  const toResult = (event: IProcessedWebhookEvent): IPaymentWebhookResult => ({
    processed: true,
    orderId: event.orderId,
    orderStatus: event.resultingOrderStatus,
  });

  /** Replays a previous result; refuses an event id reused for a different order. */
  const replayIfProcessed = async (payload: IPaymentWebhookPayload): Promise<IPaymentWebhookResult | null> => {
    const previous = await webhookEventRepository.findByEventId(payload.eventId);
    if (previous === null) {
      return null;
    }
    if (previous.orderId !== payload.orderId) {
      throw new WebhookEventConflictError(`Event "${payload.eventId}" was already used for another order.`);
    }
    return toResult(previous);
  };

  /** RN-18: call this BEFORE parsing/trusting anything inside the body. */
  const assertAuthentic = (rawBody: Uint8Array, signature: string | undefined): void => {
    if (!signatureVerifier.verify(rawBody, signature)) {
      throw new InvalidWebhookSignatureError("The webhook signature is missing or invalid.");
    }
  };

  const handlePaymentWebhook = async (payload: IPaymentWebhookPayload): Promise<IPaymentWebhookResult> => {
    // RN-19: fast path for duplicates.
    const replay = await replayIfProcessed(payload);
    if (replay !== null) {
      return replay;
    }

    const found = await orderRepository.findById(payload.orderId);
    if (found === null) {
      throw new OrderNotFoundError(`Order "${payload.orderId}" does not exist.`);
    }

    // Same lock as bids/closure of that auction: no interleaving with lazy expiry.
    return auctionLock.runExclusive(found.auctionId, async () => {
      // Re-check inside the lock: two identical webhooks may arrive at the same time.
      const duplicate = await replayIfProcessed(payload);
      if (duplicate !== null) {
        return duplicate;
      }

      const now = clock.now();

      // RN-20 (lazy): make sure an overdue order is expired BEFORE accepting a payment.
      const auction = await auctionRepository.findById(found.auctionId);
      if (auction !== null) {
        await settlement.settle(auction, now);
      }
      const order = (await orderRepository.findById(payload.orderId)) ?? found;

      if (payload.amount !== order.amount.value) {
        throw new PaymentAmountMismatchError(
          `The paid amount (${payload.amount}) does not match the order amount (${order.amount.value}).`
        );
      }

      if (payload.status === "SUCCESS") {
        // Throws OrderExpiredError when the deadline passed (nothing is changed).
        if (order.markAsPaid(now)) {
          await orderRepository.save(order);
        }
      }
      // status FAILED: the attempt is recorded but the order stays as it is (still payable until it expires).

      const event: IProcessedWebhookEvent = {
        eventId: payload.eventId,
        orderId: order.id,
        paymentStatus: payload.status,
        resultingOrderStatus: order.status,
        processedAt: now,
      };
      await webhookEventRepository.save(event);
      return toResult(event);
    });
  };

  return { assertAuthentic, handlePaymentWebhook };
};

export type WebhookService = ReturnType<typeof createWebhookService>;
