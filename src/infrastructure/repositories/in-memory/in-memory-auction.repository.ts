import { Auction } from "../../../domain/entities/auction.entity";
import { RejectedBidAttempt } from "../../../domain/entities/rejected-bid.entity";
import { IAuctionFilter, IAuctionRepository } from "../../../domain/ports/auction.repository.port";

/** Copies an auction so callers never share the stored instance (behaves like a real DB). */
const clone = (auction: Auction): Auction =>
  Auction.restore({
    id: auction.id,
    itemName: auction.itemName,
    description: auction.description,
    category: auction.category,
    sellerId: auction.sellerId,
    basePrice: auction.basePrice,
    minIncrement: auction.minIncrement,
    publishedAt: auction.publishedAt,
    closingDate: auction.closingDate,
    status: auction.status,
    winnerId: auction.winnerId,
    bids: [...auction.bids],
  });

/**
 * Phase 1 adapter (in memory). Same port as the Prisma adapter: switching
 * PERSISTENCE=memory|postgres needs NO change in domain or application code (RNF-06).
 * Also used by the unit tests.
 */
export class InMemoryAuctionRepository implements IAuctionRepository {
  private readonly auctions = new Map<string, Auction>();
  readonly rejectedBids: RejectedBidAttempt[] = [];

  async findAll(filter: IAuctionFilter = {}): Promise<Auction[]> {
    return [...this.auctions.values()]
      .filter((auction) => filter.category === undefined || auction.category === filter.category)
      .filter((auction) => filter.status === undefined || auction.status === filter.status)
      .filter((auction) => filter.sellerId === undefined || auction.sellerId === filter.sellerId)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .map(clone);
  }

  async findById(id: string): Promise<Auction | null> {
    const auction = this.auctions.get(id);
    return auction === undefined ? null : clone(auction);
  }

  async save(auction: Auction): Promise<void> {
    this.auctions.set(auction.id, clone(auction));
  }

  async saveRejectedBid(attempt: RejectedBidAttempt): Promise<void> {
    this.rejectedBids.push(attempt);
  }
}
