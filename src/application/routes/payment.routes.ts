import express, { Router } from "express";
import { getOrderById, handlePaymentWebhook } from "../controllers/payment.controller";

const paymentRoutes: Router = express.Router();

paymentRoutes.get("/orders/:order_id", getOrderById);

paymentRoutes.post("/webhooks/payments", handlePaymentWebhook);

export default paymentRoutes;