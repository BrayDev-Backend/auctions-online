import { AuctionStatus } from "../value-objects/auction-status.vo";

/** Plain serializable event payloads no entities so any adapter can send them */
export interface IBidPlacedEvent {
  auctionId: string;
  bidId: string;
  bidderId: string;
  amount: number;
  placedAt: Date;
}

export interface IOutbidEvent {
  auctionId: string;
  /** User that just lost the first place */
  previousBidderId: string;
  previousAmount: number;
  newAmount: number;
}

export interface IAuctionClosedEvent {
  auctionId: string;
  status: AuctionStatus;
  winnerId: string | null;
  winningAmount: number | null;
  orderId: string | null;
  closedAt: Date;
}

/**
 OUTPUT PORT: the domain ANNOUNCES what happened it does not know whether
 the message goes through Socket.io, a log, an email
 */
export interface IEventPublisherPort {
  publishBidPlaced(event: IBidPlacedEvent): Promise<void>;
  publishOutbid(event: IOutbidEvent): Promise<void>;
  publishAuctionClosed(event: IAuctionClosedEvent): Promise<void>;
}
