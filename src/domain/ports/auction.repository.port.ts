import { Auction } from "../entities/auction.entity";
import { RejectedBidAttempt } from "../entities/rejected-bid.entity";
import { AuctionStatus } from "../value-objects/auction-status.vo";

export interface IAuctionFilter {
  category?: string;
  status?: AuctionStatus;
  sellerId?: string;
}

/**
OUTPUT PORT: how the domain wants to store auctions
implemented by infrastructure adapters in-memory, prisma/postgresql
 */
export interface IAuctionRepository {
  findAll(filter?: IAuctionFilter): Promise<Auction[]>;
  findById(id: string): Promise<Auction | null>;
  /** Inserts or updates the auction and stores its new bids bids are never updated */
  save(auction: Auction): Promise<void>;
  /** RN-12 audit trail */
  saveRejectedBid(attempt: RejectedBidAttempt): Promise<void>;
}
