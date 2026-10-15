/**
 * Payment order states.
 *  PENDIENTE -> waiting for the external payment confirmation
 *  PAGADA    -> confirmed ONLY by the payment webhook (RN-17) — not implemented yet
 *  EXPIRADA  -> 48h deadline passed without confirmation (RN-20)
 */
export const ORDER_STATUSES = ["PENDIENTE", "PAGADA", "EXPIRADA"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
