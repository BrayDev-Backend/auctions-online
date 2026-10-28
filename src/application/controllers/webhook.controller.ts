import { Request, Response } from "express";
import { WebhookService } from "../../domain/services/webhook.service";
import { success } from "../presenters/presenters";
import { PaymentWebhookBody } from "../validators/schemas";

export const createWebhookController = (webhookService: WebhookService) => ({
  /**
   * POST /webhooks/payments. By the time this runs, the webhook gate already
   * verified the signature (RN-18) and validated the payload.
   */
  paymentNotification: async (req: Request<object, unknown, PaymentWebhookBody>, res: Response): Promise<void> => {
    const body = req.body;
    const result = await webhookService.handlePaymentWebhook({
      eventId: body.event_id,
      orderId: body.order_id,
      amount: body.amount,
      status: body.status,
    });
    // A duplicate event gets exactly this same answer (RN-19).
    res.status(200).json(
      success({ processed: result.processed, order_id: result.orderId, order_status: result.orderStatus })
    );
  },
});

export type WebhookController = ReturnType<typeof createWebhookController>;
