import {
  IAuctionClosedEvent,
  IBidPlacedEvent,
  IEventPublisherPort,
  IOutbidEvent,
} from "../../domain/ports/event-publisher.port";
import { AuctionSocketServer, auctionRoom, userRoom } from "./socket.server";

/**
 * Socket.io adapter for the IEventPublisherPort (server -> client notifications).
 *  - bid:placed      -> everyone watching the auction
 *  - bid:outbid      -> ONLY the user that lost the first place
 *  - auction:closed  -> everyone watching the auction + the winner
 */
export class SocketBroadcasterAdapter implements IEventPublisherPort {
  constructor(private readonly io: AuctionSocketServer) {}

  async publishBidPlaced(event: IBidPlacedEvent): Promise<void> {
    this.io.to(auctionRoom(event.auctionId)).emit("bid:placed", {
      auction_id: event.auctionId,
      bid_id: event.bidId,
      bidder_id: event.bidderId,
      amount: event.amount,
      placed_at: event.placedAt.toISOString(),
    });
  }

  async publishOutbid(event: IOutbidEvent): Promise<void> {
    this.io.to(userRoom(event.previousBidderId)).emit("bid:outbid", {
      auction_id: event.auctionId,
      previous_amount: event.previousAmount,
      new_amount: event.newAmount,
    });
  }

  async publishAuctionClosed(event: IAuctionClosedEvent): Promise<void> {
    const rooms = [auctionRoom(event.auctionId)];
    if (event.winnerId !== null) {
      rooms.push(userRoom(event.winnerId));
    }
    // .to([...]) sends ONCE per socket even if it is in both rooms.
    this.io.to(rooms).emit("auction:closed", {
      auction_id: event.auctionId,
      status: event.status,
      winner_id: event.winnerId,
      winning_amount: event.winningAmount,
      order_id: event.orderId,
      closed_at: event.closedAt.toISOString(),
    });
  }
}
