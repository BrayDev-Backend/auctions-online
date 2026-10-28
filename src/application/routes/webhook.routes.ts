import { Router } from "express";
import { WebhookService } from "../../domain/services/webhook.service";
import { WebhookController } from "../controllers/webhook.controller";
import { createWebhookGate, rawBodyParser } from "../middlewares/webhook-gate.middleware";

/**
 * Mounted in app.ts BEFORE express.json(): the signature is computed over the
 * raw bytes, so this route reads the body as a Buffer itself.
 */
export const createWebhookRoutes = (controller: WebhookController, webhookService: WebhookService): Router => {
  const router = Router();
  router.post("/payments", rawBodyParser, createWebhookGate(webhookService), controller.paymentNotification);
  return router;
};
