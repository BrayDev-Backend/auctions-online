import { WebhookEventConflictError } from "../../../domain/errors/domain.error";
import {
  IProcessedWebhookEvent,
  IWebhookEventRepository,
  PaymentNotificationStatus,
} from "../../../domain/ports/webhook-event.repository.port";
import { Prisma } from "../../database/generated/prisma/client";
import type { PrismaClient } from "../../database/prisma.client";

const UNIQUE_VIOLATION = "P2002";

const isPaymentStatus = (value: string): value is PaymentNotificationStatus =>
  value === "SUCCESS" || value === "FAILED";

export class PrismaWebhookEventRepository implements IWebhookEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEventId(eventId: string): Promise<IProcessedWebhookEvent | null> {
    const row = await this.prisma.processedWebhookEvent.findUnique({ where: { eventId } });
    if (row === null) {
      return null;
    }
    if (!isPaymentStatus(row.paymentStatus)) {
      throw new Error(`Corrupted webhook event ${eventId}: unknown payment status "${row.paymentStatus}".`);
    }
    return {
      eventId: row.eventId,
      orderId: row.orderId,
      paymentStatus: row.paymentStatus,
      resultingOrderStatus: row.resultingOrderStatus,
      processedAt: row.processedAt,
    };
  }

  async save(event: IProcessedWebhookEvent): Promise<void> {
    try {
      await this.prisma.processedWebhookEvent.create({ data: { ...event } });
    } catch (error) {
      // The primary key is the last line of defence for RN-19 idempotency.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new WebhookEventConflictError(`Event "${event.eventId}" was already processed.`);
      }
      throw error;
    }
  }
}
