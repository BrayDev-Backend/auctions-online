import {
  IAuctionClosedEvent,
  IBidPlacedEvent,
  IEventPublisherPort,
  IOutbidEvent,
} from "../../domain/ports/event-publisher.port";
import { Logger } from "../logger/console.logger";

/**
 * DECORATOR around any event publisher:
 *  1. logs every domain event to the console (RNF-17)
 *  2. never lets a notification failure break the business operation
 *     (a bid that was saved must not return 500 because a socket failed).
 */
export class LoggingEventPublisher implements IEventPublisherPort {
  constructor(
    private readonly inner: IEventPublisherPort,
    private readonly logger: Logger
  ) {}

  private async safely(name: string, data: object, send: () => Promise<void>): Promise<void> {
    this.logger.event(name, data);
    try {
      await send();
    } catch (error) {
      this.logger.error(`Failed to publish ${name}`, error);
    }
  }

  publishBidPlaced(event: IBidPlacedEvent): Promise<void> {
    return this.safely("BidPlaced", event, () => this.inner.publishBidPlaced(event));
  }

  publishOutbid(event: IOutbidEvent): Promise<void> {
    return this.safely("Outbid", event, () => this.inner.publishOutbid(event));
  }

  publishAuctionClosed(event: IAuctionClosedEvent): Promise<void> {
    return this.safely("AuctionClosed", event, () => this.inner.publishAuctionClosed(event));
  }
}
