import { Money } from "../value-objects/money.vo";
import { AuctionStatus } from "../value-objects/auction-status.vo";
import { Bid } from "./bid.entity";
import {
  AuctionCannotBeCanceledError,
  AuctionNotOpenError,
  BidBelowBasePriceError,
  BidIncrementTooLowError,
  InvalidAuctionDataError,
  InvalidAuctionDurationError,
  InvalidClosingDateError,
  NotAuctionOwnerError,
  SelfBidError,
  SelfOutbidError,
} from "../errors/domain.error";

const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * ONE_HOUR_MS;

/** Every field of an auction used to rebuild it from persistence */
export interface IAuctionProps {
  id: string;
  itemName: string;
  description: string;
  category: string;
  sellerId: string;
  basePrice: Money;
  minIncrement: Money;
  publishedAt: Date;
  closingDate: Date;
  status: AuctionStatus;
  winnerId: string | null;
  bids: Bid[];
}

/** Data needed to publish a brand-new auction */
export interface IPublishAuctionProps {
  id: string;
  itemName: string;
  description: string;
  category: string;
  sellerId: string;
  basePrice: Money;
  minIncrement: Money;
  closingDate: Date;
}

export interface IPlaceBidProps {
  id: string;
  bidderId: string;
  amount: Money;
}

/** awarded to a winner (RN-13) or deserted (RN-14). */
export type ClosureOutcome = "AWARDED" | "DESERTED";

export class Auction {
  readonly id: string;
  readonly itemName: string;
  readonly description: string;
  readonly category: string;
  readonly sellerId: string;
  readonly basePrice: Money;
  readonly minIncrement: Money;
  readonly publishedAt: Date;
  readonly closingDate: Date;

  private _status: AuctionStatus;
  private _winnerId: string | null;
  private readonly _bids: Bid[];

  private constructor(props: IAuctionProps) {
    this.id = props.id;
    this.itemName = props.itemName;
    this.description = props.description;
    this.category = props.category;
    this.sellerId = props.sellerId;
    this.basePrice = props.basePrice;
    this.minIncrement = props.minIncrement;
    this.publishedAt = props.publishedAt;
    this.closingDate = props.closingDate;
    this._status = props.status;
    this._winnerId = props.winnerId;
    this._bids = [...props.bids];
  }

  static publish(props: IPublishAuctionProps, now: Date): Auction {
    // RN-01: required data
    if (props.itemName.trim().length === 0) {
      throw new InvalidAuctionDataError("The item name is required.");
    }
    if (props.category.trim().length === 0) {
      throw new InvalidAuctionDataError("The category is required.");
    }
    if (props.basePrice.value <= 0) {
      throw new InvalidAuctionDataError("The base price must be greater than 0 COP.");
    }
    if (props.minIncrement.value <= 0) {
      throw new InvalidAuctionDataError("The minimum increment must be greater than 0 COP.");
    }
    if (Number.isNaN(props.closingDate.getTime())) {
      throw new InvalidAuctionDataError("The closing date is not a valid date.");
    }

    // RN-02: strictly in the future
    const durationMs = props.closingDate.getTime() - now.getTime();
    if (durationMs <= 0) {
      throw new InvalidClosingDateError("The closing date must be in the future.");
    }

    // RN-03: between 1 hour and 30 days
    if (durationMs < ONE_HOUR_MS || durationMs > THIRTY_DAYS_MS) {
      throw new InvalidAuctionDurationError(
        "The auction must last at least 1 hour and at most 30 calendar days."
      );
    }

    return new Auction({
      id: props.id,
      itemName: props.itemName.trim(),
      description: props.description.trim(),
      category: props.category.trim(),
      sellerId: props.sellerId,
      basePrice: props.basePrice,
      minIncrement: props.minIncrement,
      publishedAt: now,
      closingDate: props.closingDate,
      status: "OPEN",
      winnerId: null,
      bids: [],
    });
  }

  static restore(props: IAuctionProps): Auction {
    return new Auction(props);
  }

  get status(): AuctionStatus {
    return this._status;
  }

  get winnerId(): string | null {
    return this._winnerId;
  }

  /** Copy of the bids, so nobody can push/remove bids from outside (RN-11). */
  get bids(): readonly Bid[] {
    return [...this._bids];
  }

  /** Highest accepted bid or null when there are no bids */
  get highestBid(): Bid | null {
    return this._bids.reduce<Bid | null>(
      (highest, bid) => (highest === null || bid.amount.isGreaterThan(highest.amount) ? bid : highest),
      null
    );
  }

  isOpen(): boolean {
    return this._status === "OPEN";
  }

  /** True when the closing date has been reached */
  isDue(now: Date): boolean {
    return now.getTime() >= this.closingDate.getTime();
  }

  /** RN-04: only while open and without bids */
  canBeCanceled(): boolean {
    return this.isOpen() && this._bids.length === 0;
  }

  /** RN-04: the seller cancels the auction */
  cancel(requesterId: string): void {
    if (requesterId !== this.sellerId) {
      throw new NotAuctionOwnerError("Only the seller can cancel this auction.");
    }
    if (!this.isOpen()) {
      throw new AuctionCannotBeCanceledError(`An auction in status ${this._status} cannot be canceled.`);
    }
    if (this._bids.length > 0) {
      throw new AuctionCannotBeCanceledError(
        "The auction already has bids: the sale is committed and cannot be canceled."
      );
    }
    this._status = "CANCELLED";
  }

  /**
  validates and accepts a bid (RN-06 - RN-10) returns the accepted Bid
  throws a specific DomainError when the bid is rejected
   */
  placeBid(props: IPlaceBidProps, now: Date): Bid {
    // RN-06: only open auctions (an auction past its closing date is not open anymore)
    if (!this.isOpen() || this.isDue(now)) {
      throw new AuctionNotOpenError(`The auction is not open for bids (status: ${this._status}).`);
    }

    // RN-07: the seller cannot bid on their own auction
    if (props.bidderId === this.sellerId) {
      throw new SelfBidError("Sellers cannot bid on their own auction.");
    }

    const highest = this.highestBid;

    // RN-10: the current highest bidder cannot outbid themselves
    if (highest !== null && highest.bidderId === props.bidderId) {
      throw new SelfOutbidError("You are already the highest bidder.");
    }

    if (highest === null) {
      // RN-08: first bid >= base price
      if (!props.amount.isGreaterThanOrEqual(this.basePrice)) {
        throw new BidBelowBasePriceError(
          `The first bid must be at least the base price (${this.basePrice.value} COP).`
        );
      }
    } else {
      // RN-09: next bid >= highest + minimum increment (equal bids are rejected)
      const minimumAccepted = highest.amount.add(this.minIncrement);
      if (!props.amount.isGreaterThanOrEqual(minimumAccepted)) {
        throw new BidIncrementTooLowError(
          `The bid must be at least ${minimumAccepted.value} COP (current highest + minimum increment).`
        );
      }
    }

    const bid = new Bid({
      id: props.id,
      auctionId: this.id,
      bidderId: props.bidderId,
      amount: props.amount,
      createdAt: now,
    });
    this._bids.push(bid);
    return bid;
  }

  /**
  Lazy closure (RN-13, RN-14, RN-16) call it every time the auction is read
  or receives a bid eeturns the outcome ONLY the first time it closes
  afterwards it returns null (idempotent: closing happens only once)
   */
  closeIfDue(now: Date): ClosureOutcome | null {
    if (!this.isOpen() || !this.isDue(now)) {
      return null;
    }

    const highest = this.highestBid;
    if (highest === null) {
      this._status = "DESERTED"; // RN-14
      return "DESERTED";
    }

    this._status = "CLOSED"; // RN-13
    this._winnerId = highest.bidderId;
    return "AWARDED";
  }

  /** RN-20: the winner did not pay in time only an awarded auction can enter breach */
  markAsBreached(): boolean {
    if (this._status !== "CLOSED") {
      return false;
    }
    this._status = "BREACH";
    return true;
  }
}
