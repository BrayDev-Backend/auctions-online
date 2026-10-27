import { Auction } from "../entities/auction.entity";
import { Bid } from "../entities/bid.entity";
import { RejectedBidAttempt } from "../entities/rejected-bid.entity";
import { AuctionNotFoundError, DomainError } from "../errors/domain.error";
import { IAuctionFilter, IAuctionRepository } from "../ports/auction.repository.port";
import { IEventPublisherPort } from "../ports/event-publisher.port";
import { IClock, IIdGenerator } from "../ports/system.port";
import { KeyedMutex } from "../shared/keyed-mutex";
import { Money } from "../value-objects/money.vo";
import { AuctionSettlement } from "./auction-settlement.service";

export interface ICreateAuctionDTO {
  itemName: string;
  description: string;
  category: string;
  basePrice: number;
  minIncrement: number;
  closingDate: Date;
}

export interface IPlaceBidDTO {
  auctionId: string;
  bidderId: string;
  amount: number;
}

export interface IPlaceBidResult {
  auction: Auction;
  bid: Bid;
}

export interface IAuctionServiceDeps {
  auctionRepository: IAuctionRepository;
  eventPublisher: IEventPublisherPort;
  settlement: AuctionSettlement;
  auctionLock: KeyedMutex;
  clock: IClock;
  idGenerator: IIdGenerator;
}

/**
 * Auction use cases. Factory function = functional style + dependency injection:
 * the service receives PORTS, never concrete adapters, so Postgres can be
 * swapped for in-memory (or anything else) without touching this file (RNF-06).
 */
export const createAuctionService = (deps: IAuctionServiceDeps) => {
  const { auctionRepository, eventPublisher, settlement, auctionLock, clock, idGenerator } = deps;

  /** Loads an auction and applies the lazy evaluation. Must run inside the lock. */
  const loadSettled = async (auctionId: string): Promise<Auction> => {
    const auction = await auctionRepository.findById(auctionId);
    if (auction === null) {
      throw new AuctionNotFoundError(`Auction "${auctionId}" does not exist.`);
    }
    await settlement.settle(auction, clock.now());
    return auction;
  };

  const listAuctions = async (filter: IAuctionFilter = {}): Promise<Auction[]> => {
    const auctions = await auctionRepository.findAll(filter);
    const now = clock.now();

    const settled = await Promise.all(
      auctions.map((auction) =>
        settlement.needsSettlement(auction, now)
          ? auctionLock.runExclusive(auction.id, () => loadSettled(auction.id))
          : Promise.resolve(auction)
      )
    );

    // The status may have changed during settlement, so re-apply that filter.
    return filter.status ? settled.filter((auction) => auction.status === filter.status) : settled;
  };

  const getAuctionById = async (auctionId: string): Promise<Auction> =>
    auctionLock.runExclusive(auctionId, () => loadSettled(auctionId));

  const createAuction = async (dto: ICreateAuctionDTO, sellerId: string): Promise<Auction> => {
    const auction = Auction.publish(
      {
        id: idGenerator.generate(),
        itemName: dto.itemName,
        description: dto.description,
        category: dto.category,
        sellerId,
        basePrice: Money.create(dto.basePrice),
        minIncrement: Money.create(dto.minIncrement),
        closingDate: dto.closingDate,
      },
      clock.now()
    );
    await auctionRepository.save(auction);
    return auction;
  };

  const cancelAuction = async (auctionId: string, requesterId: string): Promise<Auction> =>
    auctionLock.runExclusive(auctionId, async () => {
      const auction = await loadSettled(auctionId);
      auction.cancel(requesterId);
      await auctionRepository.save(auction);
      return auction;
    });

  const placeBid = async (dto: IPlaceBidDTO): Promise<IPlaceBidResult> =>
    auctionLock.runExclusive(dto.auctionId, async () => {
      const auction = await loadSettled(dto.auctionId);
      const now = clock.now();
      const previousHighest = auction.highestBid;

      let bid: Bid;
      try {
        bid = auction.placeBid(
          { id: idGenerator.generate(), bidderId: dto.bidderId, amount: Money.create(dto.amount) },
          now
        );
      } catch (error) {
        // RN-12: every rejected bid is recorded with its specific reason.
        if (error instanceof DomainError) {
          await auctionRepository.saveRejectedBid(
            new RejectedBidAttempt({
              id: idGenerator.generate(),
              auctionId: auction.id,
              bidderId: dto.bidderId,
              amount: dto.amount,
              reasonCode: error.errorCode,
              reasonMessage: error.message,
              attemptedAt: now,
            })
          );
        }
        throw error;
      }

      await auctionRepository.save(auction);

      await eventPublisher.publishBidPlaced({
        auctionId: auction.id,
        bidId: bid.id,
        bidderId: bid.bidderId,
        amount: bid.amount.value,
        placedAt: bid.createdAt,
      });

      if (previousHighest !== null && previousHighest.bidderId !== bid.bidderId) {
        await eventPublisher.publishOutbid({
          auctionId: auction.id,
          previousBidderId: previousHighest.bidderId,
          previousAmount: previousHighest.amount.value,
          newAmount: bid.amount.value,
        });
      }

      return { auction, bid };
    });

  return { listAuctions, getAuctionById, createAuction, cancelAuction, placeBid };
};

export type AuctionService = ReturnType<typeof createAuctionService>;