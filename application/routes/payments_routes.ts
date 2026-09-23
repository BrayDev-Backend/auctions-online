import express, { Router } from "express";
import { getOrderById, handlePaymentWebhook } from "../controllers/payments_handlers";

const paymentsRouter: Router = express.Router();

paymentsRouter.get("/orders/:order_id", getOrderById);

paymentsRouter.post("/webhooks/payments", handlePaymentWebhook);

export default paymentsRouter;