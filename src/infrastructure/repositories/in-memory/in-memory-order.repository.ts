import { PaymentOrder } from "../../../domain/entities/order.entity";
import { IOrderRepository } from "../../../domain/ports/order.repository.port";

const clone = (order: PaymentOrder): PaymentOrder =>
  PaymentOrder.restore({
    id: order.id,
    auctionId: order.auctionId,
    winnerId: order.winnerId,
    amount: order.amount,
    status: order.status,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
  });

export class InMemoryOrderRepository implements IOrderRepository {
  private readonly orders = new Map<string, PaymentOrder>();

  async findById(id: string): Promise<PaymentOrder | null> {
    const order = this.orders.get(id);
    return order === undefined ? null : clone(order);
  }

  async findByAuctionId(auctionId: string): Promise<PaymentOrder | null> {
    const order = [...this.orders.values()].find((candidate) => candidate.auctionId === auctionId);
    return order === undefined ? null : clone(order);
  }

  async findByWinnerId(winnerId: string): Promise<PaymentOrder[]> {
    return [...this.orders.values()].filter((order) => order.winnerId === winnerId).map(clone);
  }

  async save(order: PaymentOrder): Promise<void> {
    const sameAuction = [...this.orders.values()].find(
      (candidate) => candidate.auctionId === order.auctionId && candidate.id !== order.id
    );
    if (sameAuction !== undefined) {
      // Mirrors the UNIQUE(auction_id) constraint of the database (RN-16).
      throw new Error(`Auction ${order.auctionId} already has a payment order.`);
    }
    this.orders.set(order.id, clone(order));
  }

  /** Helper for tests. */
  count(): number {
    return this.orders.size;
  }
}
