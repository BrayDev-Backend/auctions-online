import { Auction } from "../../../domain/entities/auction.entity";
import { RejectedBidAttempt } from "../../../domain/entities/rejected-bid.entity";
import { IAuctionFilter, IAuctionRepository } from "../../../domain/ports/auction.repository.port";
import type { PrismaClient } from "../../database/prisma.client";
import { toDomainAuction } from "./prisma.mappers";

/** PostgreSQL adapter (via Prisma) for the IAuctionRepository port. */
export class PrismaAuctionRepository implements IAuctionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(filter: IAuctionFilter = {}): Promise<Auction[]> {
    const rows = await this.prisma.auction.findMany({
      where: {
        category: filter.category,
        status: filter.status,
        sellerId: filter.sellerId,
      },
      include: { bids: true },
      orderBy: { publishedAt: "desc" },
    });
    return rows.map(toDomainAuction);
  }

  async findById(id: string): Promise<Auction | null> {
    const row = await this.prisma.auction.findUnique({ where: { id }, include: { bids: true } });
    return row === null ? null : toDomainAuction(row);
  }

  async save(auction: Auction): Promise<void> {
    // Only the mutable fields are updated: price, increment and closing date never change (RN-05).
    const mutable = { status: auction.status, winnerId: auction.winnerId };

    await this.prisma.$transaction([
      this.prisma.auction.upsert({
        where: { id: auction.id },
        update: mutable,
        create: {
          id: auction.id,
          itemName: auction.itemName,
          description: auction.description,
          category: auction.category,
          sellerId: auction.sellerId,
          basePrice: BigInt(auction.basePrice.value),
          minIncrement: BigInt(auction.minIncrement.value),
          publishedAt: auction.publishedAt,
          closingDate: auction.closingDate,
          ...mutable,
        },
      }),
      // Bids are append-only (RN-11): insert the new ones, never update existing ones.
      this.prisma.bid.createMany({
        data: auction.bids.map((bid) => ({
          id: bid.id,
          auctionId: bid.auctionId,
          bidderId: bid.bidderId,
          amount: BigInt(bid.amount.value),
          createdAt: bid.createdAt,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  async saveRejectedBid(attempt: RejectedBidAttempt): Promise<void> {
    await this.prisma.rejectedBidAttempt.create({
      data: {
        id: attempt.id,
        auctionId: attempt.auctionId,
        bidderId: attempt.bidderId,
        // The attempted amount may be invalid (decimal); store the integer part for the audit.
        amount: BigInt(Math.trunc(attempt.amount)),
        reasonCode: attempt.reasonCode,
        reasonMessage: attempt.reasonMessage,
        attemptedAt: attempt.attemptedAt,
      },
    });
  }
}
