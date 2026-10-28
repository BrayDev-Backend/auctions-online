import express, { NextFunction, Request, RequestHandler, Response } from "express";
import { WebhookService } from "../../domain/services/webhook.service";
import { ValidationError } from "../errors/application.error";
import { paymentWebhookSchema } from "../validators/schemas";
import { parseInput } from "./validate.middleware";

/** Reads the body as raw bytes (the signature is computed over the exact bytes). */
export const rawBodyParser: RequestHandler = express.raw({ type: () => true, limit: "100kb" });

/**
 * RN-18 gate for the payment webhook. Order matters:
 *  1. verify the signature over the RAW body  -> 401, nothing else is read
 *  2. only then parse the JSON                 -> 400 if malformed
 *  3. validate the payload format              -> 400 if invalid
 */
export const createWebhookGate = (webhookService: WebhookService): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    webhookService.assertAuthentic(rawBody, req.header("x-signature"));

    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new ValidationError("The webhook body is not valid JSON.");
    }

    req.body = parseInput(paymentWebhookSchema, json);
    next();
  };
