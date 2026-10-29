import { describe, expect, it } from "vitest";
import { AuctionNotFoundError, SelfBidError } from "../../src/domain/errors/domain.error";
import { buildTestContext, createOpenAuction, HOUR_MS } from "../helpers/context";

describe("Auction use cases", () => {
  it("RN-12: every rejected bid is recorded with its specific reason", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);

    await expect(ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "seller", amount: 100_000 })).rejects.toThrow(SelfBidError);
    await expect(ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 5 })).rejects.toThrow();
    await expect(ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100.5 })).rejects.toThrow();

    expect(ctx.auctionRepository.rejectedBids.map((r) => r.reasonCode)).toEqual([
      "SELF_BID_NOT_ALLOWED",
      "BID_BELOW_BASE_PRICE",
      "INVALID_MONEY",
    ]);
    expect(ctx.auctionRepository.rejectedBids[0]?.reasonMessage).toContain("own auction");
    // None of them became an accepted bid.
    expect((await ctx.auctionService.getAuctionById(auction.id)).bids).toHaveLength(0);
  });

  it("announces accepted bids and outbid alerts through the event port", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);

    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 });
    expect(ctx.publisher.bidPlaced).toHaveLength(1);
    expect(ctx.publisher.outbid).toHaveLength(0); // nobody was outbid by the first bid

    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ben", amount: 110_000 });
    expect(ctx.publisher.bidPlaced).toHaveLength(2);
    expect(ctx.publisher.outbid).toEqual([
      { auctionId: auction.id, previousBidderId: "ana", previousAmount: 100_000, newAmount: 110_000 },
    ]);
  });

  it("does not announce rejected bids", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);
    await expect(ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "seller", amount: 100_000 })).rejects.toThrow();
    expect(ctx.publisher.bidPlaced).toHaveLength(0);
  });

  it("serializes concurrent bids on the same auction: exactly one wins", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);

    const results = await Promise.allSettled([
      ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 }),
      ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ben", amount: 100_000 }),
      ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "cris", amount: 100_000 }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await ctx.auctionService.getAuctionById(auction.id)).bids).toHaveLength(1);
    expect(ctx.auctionRepository.rejectedBids).toHaveLength(2);
  });

  it("a cancelled auction is no longer biddable", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);
    await ctx.auctionService.cancelAuction(auction.id, "seller");
    await expect(ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 })).rejects.toThrow();
  });

  it("unknown auctions raise AuctionNotFoundError", async () => {
    const ctx = buildTestContext();
    await expect(ctx.auctionService.getAuctionById("nope")).rejects.toThrow(AuctionNotFoundError);
  });

  it("filters the list by category and status", async () => {
    const ctx = buildTestContext();
    await createOpenAuction(ctx);
    const other = await createOpenAuction(ctx);
    await ctx.auctionService.cancelAuction(other.id, "seller");

    expect(await ctx.auctionService.listAuctions({ status: "OPEN" })).toHaveLength(1);
    expect(await ctx.auctionService.listAuctions({ status: "CANCELLED" })).toHaveLength(1);
    expect(await ctx.auctionService.listAuctions({ category: "Electronics" })).toHaveLength(2);
    expect(await ctx.auctionService.listAuctions({ category: "Nope" })).toHaveLength(0);
  });
});

describe("Lazy closure and settlement (RN-13 .. RN-16, RN-20)", () => {
  it("RN-13 + RN-15: reading an overdue auction awards it and creates ONE order with a 48h deadline", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx, { hours: 2 });
    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 });
    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ben", amount: 120_000 });

    ctx.clock.advance(3 * HOUR_MS); // 1 hour after closing
    const read = await ctx.auctionService.getAuctionById(auction.id);

    expect(read.status).toBe("CLOSED");
    expect(read.winnerId).toBe("ben");

    const order = await ctx.orderRepository.findByAuctionId(auction.id);
    expect(order?.winnerId).toBe("ben");
    expect(order?.amount.value).toBe(120_000);
    expect(order?.status).toBe("PENDING");
    // deadline = closing date + 48h
    expect(order?.expiresAt.getTime()).toBe(read.closingDate.getTime() + 48 * HOUR_MS);
  });

  it("RN-14: an overdue auction without bids is deserted and generates NO order", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);

    ctx.clock.advance(3 * HOUR_MS);
    const read = await ctx.auctionService.getAuctionById(auction.id);

    expect(read.status).toBe("DESERTED");
    expect(ctx.orderRepository.count()).toBe(0);
  });

  it("RN-16: closing is idempotent: many reads create one order and one closure event", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);
    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 });

    ctx.clock.advance(3 * HOUR_MS);
    await Promise.all([
      ctx.auctionService.getAuctionById(auction.id),
      ctx.auctionService.getAuctionById(auction.id),
      ctx.auctionService.listAuctions(),
    ]);
    await ctx.auctionService.getAuctionById(auction.id);

    expect(ctx.orderRepository.count()).toBe(1);
    expect(ctx.publisher.closed).toHaveLength(1);
    expect(ctx.publisher.closed[0]).toMatchObject({ auctionId: auction.id, status: "CLOSED", winnerId: "ana", winningAmount: 100_000 });
  });

  it("RN-06: a bid placed after the closing date is rejected and triggers the closure", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx);
    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 });

    ctx.clock.advance(3 * HOUR_MS);
    await expect(ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ben", amount: 500_000 })).rejects.toThrow();

    expect(ctx.auctionRepository.rejectedBids.at(-1)?.reasonCode).toBe("AUCTION_NOT_OPEN");
    expect((await ctx.auctionService.getAuctionById(auction.id)).winnerId).toBe("ana");
  });

  it("RN-20: an unpaid order expires after 48h and the auction enters BREACH", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx, { hours: 2 });
    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 });

    ctx.clock.advance(3 * HOUR_MS);
    await ctx.auctionService.getAuctionById(auction.id); // closes and creates the order
    expect((await ctx.orderRepository.findByAuctionId(auction.id))?.status).toBe("PENDING");

    ctx.clock.advance(47 * HOUR_MS); // still inside the 48h window (closing + 48h not reached yet)
    expect((await ctx.auctionService.getAuctionById(auction.id)).status).toBe("CLOSED");

    ctx.clock.advance(2 * HOUR_MS); // now past closing + 48h
    const breached = await ctx.auctionService.getAuctionById(auction.id);

    expect(breached.status).toBe("BREACH");
    expect((await ctx.orderRepository.findByAuctionId(auction.id))?.status).toBe("EXPIRED");
  });

  it("RN-20 is also evaluated when the winner reads their orders", async () => {
    const ctx = buildTestContext();
    const auction = await createOpenAuction(ctx, { hours: 2 });
    await ctx.auctionService.placeBid({ auctionId: auction.id, bidderId: "ana", amount: 100_000 });
    ctx.clock.advance(3 * HOUR_MS);
    await ctx.auctionService.getAuctionById(auction.id);

    ctx.clock.advance(50 * HOUR_MS);
    const orders = await ctx.orderService.listMyOrders("ana");

    expect(orders[0]?.status).toBe("EXPIRED");
    expect((await ctx.auctionRepository.findById(auction.id))?.status).toBe("BREACH");
  });
});
