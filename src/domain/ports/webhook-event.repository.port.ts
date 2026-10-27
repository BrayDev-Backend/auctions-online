import { OrderStatus } from "../value-objects/order-status.vo";

export type PaymentNotificationStatus = "SUCCESS" | "FAILED";

/** Memory of a webhook event that was already processed (RN-19 idempotency) */
export interface IProcessedWebhookEvent {
  eventId: string;
  orderId: string;
  paymentStatus: PaymentNotificationStatus;
  /** Order status right after processing replayed verbatim on duplicates */
  resultingOrderStatus: OrderStatus;
  processedAt: Date;
}

/** OUTPUT PORT persistence of processed webhook events */
export interface IWebhookEventRepository {
  findByEventId(eventId: string): Promise<IProcessedWebhookEvent | null>;
  /** Must throw WebhookEventConflictError if the eventId already exists */
  save(event: IProcessedWebhookEvent): Promise<void>;
}
