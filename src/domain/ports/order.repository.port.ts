import { PaymentOrder } from "../entities/order.entity";

/** OUTPUT PORT for payment orders */
export interface IOrderRepository {
  findById(id: string): Promise<PaymentOrder | null>;
  findByAuctionId(auctionId: string): Promise<PaymentOrder | null>;
  findByWinnerId(winnerId: string): Promise<PaymentOrder[]>;
  /** Inserts or updates Only ONE order per auction may exist (RN-16)*/
  save(order: PaymentOrder): Promise<void>;
}
