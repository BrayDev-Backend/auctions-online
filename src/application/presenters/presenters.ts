import { Auction } from "../../domain/entities/auction.entity";
import { Bid } from "../../domain/entities/bid.entity";
import { PaymentOrder } from "../../domain/entities/order.entity";
import { User } from "../../domain/entities/user.entity";

/**
 * PRESENTERS: the only place that decides what leaves the API.
 * JSON keys are snake_case. Money is always an integer number of COP (RN-21).
 */

/** Standard success envelope. */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export const success = <T>(data: T): ApiSuccess<T> => ({ ok: true, data });

// RN-23: bid history is PUBLIC, bidder contact info is PRIVATE -> only the id is exposed.
export interface BidResponse {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
}

export interface AuctionResponse {
  id: string;
  item_name: string;
  description: string;
  category: string;
  seller_id: string;
  base_price: number;
  min_increment: number;
  current_highest_bid: number | null;
  published_at: string;
  closing_date: string;
  status: string;
  winner_id: string | null;
  bids: BidResponse[];
}

export interface OrderResponse {
  id: string;
  auction_id: string;
  winner_id: string;
  amount: number;
  status: string;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
}

/** Public data of a user. No email, no password hash. */
export interface PublicUserResponse {
  id: string;
  name: string;
}

/** Own profile: the owner can see their email (private for everybody else). */
export interface ProfileResponse extends PublicUserResponse {
  email: string;
  created_at: string;
}

export const toBidResponse = (bid: Bid): BidResponse => ({
  id: bid.id,
  auction_id: bid.auctionId,
  bidder_id: bid.bidderId,
  amount: bid.amount.value,
  created_at: bid.createdAt.toISOString(),
});

export const toAuctionResponse = (auction: Auction): AuctionResponse => ({
  id: auction.id,
  item_name: auction.itemName,
  description: auction.description,
  category: auction.category,
  seller_id: auction.sellerId,
  base_price: auction.basePrice.value,
  min_increment: auction.minIncrement.value,
  current_highest_bid: auction.highestBid?.amount.value ?? null,
  published_at: auction.publishedAt.toISOString(),
  closing_date: auction.closingDate.toISOString(),
  status: auction.status,
  winner_id: auction.winnerId,
  bids: [...auction.bids]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(toBidResponse),
});

export const toOrderResponse = (order: PaymentOrder): OrderResponse => ({
  id: order.id,
  auction_id: order.auctionId,
  winner_id: order.winnerId,
  amount: order.amount.value,
  status: order.status,
  created_at: order.createdAt.toISOString(),
  expires_at: order.expiresAt.toISOString(),
  paid_at: order.paidAt?.toISOString() ?? null,
});

export const toProfileResponse = (user: User): ProfileResponse => ({
  id: user.id,
  name: user.name,
  email: user.email.value,
  created_at: user.createdAt.toISOString(),
});
