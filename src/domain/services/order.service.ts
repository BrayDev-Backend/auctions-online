import { PaymentOrder } from "../entities/order.entity";
import { OrderAccessDeniedError, OrderNotFoundError } from "../errors/domain.error";
import { IAuctionRepository } from "../ports/auction.repository.port";
import { IOrderRepository } from "../ports/order.repository.port";
import { IClock } from "../ports/system.port";
import { KeyedMutex } from "../shared/keyed-mutex";
import { AuctionSettlement } from "./auction-settlement.service";

export interface IOrderServiceDeps {
  orderRepository: IOrderRepository;
  auctionRepository: IAuctionRepository;
  settlement: AuctionSettlement;
  auctionLock: KeyedMutex;
  clock: IClock;
}

export const createOrderService = (deps: IOrderServiceDeps) => {
  const { orderRepository, auctionRepository, settlement, auctionLock, clock } = deps;

  /** Applies lazy evaluation (RN-20 expiry) to the auction that owns the order. */
  const settleAuctionOf = async (auctionId: string): Promise<void> =>
    auctionLock.runExclusive(auctionId, async () => {
      const auction = await auctionRepository.findById(auctionId);
      if (auction !== null) {
        await settlement.settle(auction, clock.now());
      }
    });

  /** Only the winner (buyer) or the seller of the auction can see an order. */
  const getOrderById = async (orderId: string, requesterId: string): Promise<PaymentOrder> => {
    const order = await orderRepository.findById(orderId);
    if (order === null) {
      throw new OrderNotFoundError(`Order "${orderId}" does not exist.`);
    }

    const auction = await auctionRepository.findById(order.auctionId);
    const isWinner = order.winnerId === requesterId;
    const isSeller = auction !== null && auction.sellerId === requesterId;
    if (!isWinner && !isSeller) {
      throw new OrderAccessDeniedError("You are not allowed to see this order.");
    }

    await settleAuctionOf(order.auctionId);
    return (await orderRepository.findById(orderId)) ?? order;
  };

  /** Orders the user has to pay (auctions they won). */
  const listMyOrders = async (userId: string): Promise<PaymentOrder[]> => {
    const orders = await orderRepository.findByWinnerId(userId);
    const pending = orders.filter((order) => order.status === "PENDING");
    if (pending.length === 0) {
      return orders;
    }
    await Promise.all(pending.map((order) => settleAuctionOf(order.auctionId)));
    return orderRepository.findByWinnerId(userId);
  };

  return { getOrderById, listMyOrders };
};

export type OrderService = ReturnType<typeof createOrderService>;
