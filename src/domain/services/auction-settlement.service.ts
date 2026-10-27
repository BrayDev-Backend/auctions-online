import { Auction } from "../entities/auction.entity";
import { PaymentOrder } from "../entities/order.entity";
import { IAuctionRepository } from "../ports/auction.repository.port";
import { IOrderRepository } from "../ports/order.repository.port";
import { IEventPublisherPort } from "../ports/event-publisher.port";
import { IIdGenerator } from "../ports/system.port";

export interface IAuctionSettlementDeps {
  auctionRepository: IAuctionRepository;
  orderRepository: IOrderRepository;
  eventPublisher: IEventPublisherPort;
  idGenerator: IIdGenerator;
}

/**
 * LAZY EVALUATION of an auction's lifecycle. There are no cron jobs: every use
 * case that reads an auction (or bids on it) calls `settle()` first.
 *
 * It takes care of:
 *  - RN-13 / RN-14 / RN-16: closing the auction once (awarded or deserted)
 *  - RN-15: making sure the awarded auction has exactly ONE payment order
 *  - RN-20: expiring the order after 48h and moving the auction to INCUMPLIMIENTO
 *
 * Callers must run it inside the auction lock (see KeyedMutex) to avoid races.
 */
export const createAuctionSettlement = (deps: IAuctionSettlementDeps) => {
  const { auctionRepository, orderRepository, eventPublisher, idGenerator } = deps;

  /** Returns the existing order of the auction or creates it (idempotent, RN-16). */
  const ensurePaymentOrder = async (auction: Auction, now: Date): Promise<PaymentOrder | null> => {
    const existing = await orderRepository.findByAuctionId(auction.id);
    if (existing !== null) {
      return existing;
    }

    const winningBid = auction.highestBid;
    if (winningBid === null || auction.winnerId === null) {
      return null;
    }

    const order = PaymentOrder.createForAward({
      id: idGenerator.generate(),
      auctionId: auction.id,
      winnerId: auction.winnerId,
      amount: winningBid.amount,
      awardedAt: auction.closingDate,
      now,
    });
    await orderRepository.save(order);
    return order;
  };

  /** True when calling settle() could change something. Cheap check to skip work. */
  const needsSettlement = (auction: Auction, now: Date): boolean =>
    (auction.isOpen() && auction.isDue(now)) || auction.status === "CLOSED";

  const settle = async (auction: Auction, now: Date): Promise<void> => {
    // 1) Close it if the closing date has passed (does nothing if already closed).
    const outcome = auction.closeIfDue(now);
    if (outcome !== null) {
      await auctionRepository.save(auction);
    }

    // 2) An awarded auction must have its payment order; check the 48h deadline.
    let order: PaymentOrder | null = null;
    if (auction.status === "CLOSED") {
      order = await ensurePaymentOrder(auction, now);
      if (order !== null && order.expireIfDue(now)) {
        await orderRepository.save(order);
        auction.markAsBreached();
        await auctionRepository.save(auction);
      }
    }

    // 3) Announce the closure only the first time it happens.
    if (outcome !== null) {
      await eventPublisher.publishAuctionClosed({
        auctionId: auction.id,
        status: auction.status,
        winnerId: auction.winnerId,
        winningAmount: auction.highestBid?.amount.value ?? null,
        orderId: order?.id ?? null,
        closedAt: auction.closingDate,
      });
    }
  };

  return { settle, needsSettlement };
};

export type AuctionSettlement = ReturnType<typeof createAuctionSettlement>;
