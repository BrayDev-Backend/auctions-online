import { z } from "zod";
import { AUCTION_STATUSES } from "../../domain/value-objects/auction-status.vo";

/**
 * INPUT FORMAT schemas (types, required fields, lengths).
 * Business rules (positive prices, 1h-30d duration, bid increments...) are NOT
 * here: they are enforced by the domain.
 *
 * Amounts are accepted as any finite number on purpose: a decimal or negative
 * bid must reach the domain so it is rejected AND recorded (RN-12, RN-21).
 */
const amount = z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().min(3).max(254),
  // bcrypt only uses the first 72 bytes of a password.
  password: z.string().min(8).max(72),
});
export type RegisterBody = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(72),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const createAuctionSchema = z.object({
  item_name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  category: z.string().trim().min(1).max(100),
  base_price: amount,
  min_increment: amount,
  closing_date: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
});
export type CreateAuctionBody = z.infer<typeof createAuctionSchema>;

export const placeBidSchema = z.object({ amount });
export type PlaceBidBody = z.infer<typeof placeBidSchema>;

export const listAuctionsQuerySchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  status: z.enum(AUCTION_STATUSES).optional(),
  seller_id: z.string().trim().min(1).max(100).optional(),
});
export type ListAuctionsQuery = z.infer<typeof listAuctionsQuerySchema>;

export const paymentWebhookSchema = z.object({
  event_id: z.string().trim().min(1).max(100),
  order_id: z.string().trim().min(1).max(100),
  amount,
  status: z.enum(["SUCCESS", "FAILED"]),
});
export type PaymentWebhookBody = z.infer<typeof paymentWebhookSchema>;
