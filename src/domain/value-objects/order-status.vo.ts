export const ORDER_STATUSES = ["PENDING", "PAID", "EXPIRED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
