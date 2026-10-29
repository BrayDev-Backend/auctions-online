import { describe, expect, it } from "vitest";
import { Auction } from "../../src/domain/entities/auction.entity";
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
} from "../../src/domain/errors/domain.error";
import { Money } from "../../src/domain/value-objects/money.vo";
import { HOUR_MS, T0 } from "../helpers/context";

const publish = (overrides: Partial<{ itemName: string; category: string; base: number; inc: number; closing: Date }> = {}) =>
  Auction.publish(
    {
      id: "a1",
      itemName: overrides.itemName ?? "Camera",
      description: "desc",
      category: overrides.category ?? "Electronics",
      sellerId: "seller",
      basePrice: Money.create(overrides.base ?? 100_000),
      minIncrement: Money.create(overrides.inc ?? 5_000),
      closingDate: overrides.closing ?? new Date(T0.getTime() + 2 * HOUR_MS),
    },
    T0
  );

const bid = (auction: Auction, bidderId: string, amount: number, at: Date = T0) =>
  auction.placeBid({ id: `bid-${bidderId}-${amount}`, bidderId, amount: Money.create(amount) }, at);

describe("Auction publication (RN-01, RN-02, RN-03)", () => {
  it("publishes an open auction without bids", () => {
    const auction = publish();
    expect(auction.status).toBe("OPEN");
    expect(auction.bids).toHaveLength(0);
    expect(auction.publishedAt).toEqual(T0);
  });

  it("RN-01: requires item name and category", () => {
    expect(() => publish({ itemName: "  " })).toThrow(InvalidAuctionDataError);
    expect(() => publish({ category: "" })).toThrow(InvalidAuctionDataError);
  });

  it("RN-01: base price and increment must be greater than 0", () => {
    expect(() => publish({ base: 0 })).toThrow(InvalidAuctionDataError);
    expect(() => publish({ inc: 0 })).toThrow(InvalidAuctionDataError);
  });

  it("RN-02: closing date must be in the future", () => {
    expect(() => publish({ closing: new Date(T0.getTime() - 1) })).toThrow(InvalidClosingDateError);
    expect(() => publish({ closing: T0 })).toThrow(InvalidClosingDateError);
  });

  it("RN-03: duration must be at least 1 hour", () => {
    expect(() => publish({ closing: new Date(T0.getTime() + HOUR_MS - 1) })).toThrow(InvalidAuctionDurationError);
    expect(() => publish({ closing: new Date(T0.getTime() + HOUR_MS) })).not.toThrow();
  });

  it("RN-03: duration must be at most 30 days", () => {
    const thirtyDays = 30 * 24 * HOUR_MS;
    expect(() => publish({ closing: new Date(T0.getTime() + thirtyDays) })).not.toThrow();
    expect(() => publish({ closing: new Date(T0.getTime() + thirtyDays + 1) })).toThrow(InvalidAuctionDurationError);
  });
});

describe("Placing bids (RN-06 .. RN-11)", () => {
  it("RN-08: first bid must be >= base price", () => {
    const auction = publish();
    expect(() => bid(auction, "ana", 99_999)).toThrow(BidBelowBasePriceError);
    expect(bid(auction, "ana", 100_000).amount.value).toBe(100_000); // equal to base is accepted
  });

  it("RN-09: next bid must exceed the highest by at least the increment", () => {
    const auction = publish();
    bid(auction, "ana", 100_000);
    expect(() => bid(auction, "ben", 104_999)).toThrow(BidIncrementTooLowError);
    expect(bid(auction, "ben", 105_000).amount.value).toBe(105_000); // exactly highest + increment is accepted
  });

  it("RN-09: an equal bid is rejected", () => {
    const auction = publish();
    bid(auction, "ana", 100_000);
    expect(() => bid(auction, "ben", 100_000)).toThrow(BidIncrementTooLowError);
  });

  it("RN-07: the seller cannot bid on their own auction", () => {
    const auction = publish();
    expect(() => bid(auction, "seller", 100_000)).toThrow(SelfBidError);
  });

  it("RN-10: the highest bidder cannot outbid themselves", () => {
    const auction = publish();
    bid(auction, "ana", 100_000);
    expect(() => bid(auction, "ana", 200_000)).toThrow(SelfOutbidError);
  });

  it("RN-06: bids are only accepted while the auction is open", () => {
    const cancelled = publish();
    cancelled.cancel("seller");
    expect(() => bid(cancelled, "ana", 100_000)).toThrow(AuctionNotOpenError);

    const overdue = publish();
    const afterClosing = new Date(T0.getTime() + 3 * HOUR_MS);
    expect(() => bid(overdue, "ana", 100_000, afterClosing)).toThrow(AuctionNotOpenError);
  });

  it("tracks the highest bid", () => {
    const auction = publish();
    expect(auction.highestBid).toBeNull();
    bid(auction, "ana", 100_000);
    bid(auction, "ben", 110_000);
    expect(auction.highestBid?.amount.value).toBe(110_000);
    expect(auction.highestBid?.bidderId).toBe("ben");
  });

  it("RN-11: accepted bids cannot be removed from outside", () => {
    const auction = publish();
    bid(auction, "ana", 100_000);
    const copy = auction.bids as unknown as unknown[];
    copy.pop();
    expect(auction.bids).toHaveLength(1);
  });
});

describe("Cancellation (RN-04)", () => {
  it("the seller can cancel while there are no bids", () => {
    const auction = publish();
    expect(auction.canBeCanceled()).toBe(true);
    auction.cancel("seller");
    expect(auction.status).toBe("CANCELLED");
  });

  it("nobody else can cancel it", () => {
    expect(() => publish().cancel("ana")).toThrow(NotAuctionOwnerError);
  });

  it("cannot be cancelled once a bid was accepted", () => {
    const auction = publish();
    bid(auction, "ana", 100_000);
    expect(auction.canBeCanceled()).toBe(false);
    expect(() => auction.cancel("seller")).toThrow(AuctionCannotBeCanceledError);
    expect(auction.status).toBe("OPEN");
  });

  it("cannot be cancelled twice", () => {
    const auction = publish();
    auction.cancel("seller");
    expect(() => auction.cancel("seller")).toThrow(AuctionCannotBeCanceledError);
  });
});

describe("Closure (RN-13, RN-14, RN-16)", () => {
  const afterClosing = new Date(T0.getTime() + 3 * HOUR_MS);

  it("does nothing before the closing date", () => {
    const auction = publish();
    expect(auction.closeIfDue(new Date(T0.getTime() + HOUR_MS))).toBeNull();
    expect(auction.status).toBe("OPEN");
  });

  it("RN-13: awards the highest bidder", () => {
    const auction = publish();
    bid(auction, "ana", 100_000);
    bid(auction, "ben", 110_000);
    expect(auction.closeIfDue(afterClosing)).toBe("AWARDED");
    expect(auction.status).toBe("CLOSED");
    expect(auction.winnerId).toBe("ben");
  });

  it("RN-14: without bids it is declared deserted", () => {
    const auction = publish();
    expect(auction.closeIfDue(afterClosing)).toBe("DESERTED");
    expect(auction.status).toBe("DESERTED");
    expect(auction.winnerId).toBeNull();
  });

  it("RN-16: closing happens only once", () => {
    const auction = publish();
    bid(auction, "ana", 100_000);
    expect(auction.closeIfDue(afterClosing)).toBe("AWARDED");
    expect(auction.closeIfDue(afterClosing)).toBeNull();
    expect(auction.closeIfDue(new Date(afterClosing.getTime() + 99 * HOUR_MS))).toBeNull();
    expect(auction.winnerId).toBe("ana");
  });

  it("RN-05: price, increment and closing date are readonly (no setters exist)", () => {
    const auction = publish();
    const descriptor = (name: string) => Object.getOwnPropertyDescriptor(Auction.prototype, name);
    for (const field of ["basePrice", "minIncrement", "closingDate"]) {
      expect(descriptor(field)?.set).toBeUndefined();
    }
  });
});
