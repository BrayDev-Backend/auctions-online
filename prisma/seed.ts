/**
 * Development seed: loads the old mock dataset INTO PostgreSQL.
 *   npm run db:seed
 *
 * - Creates users usr_001..usr_020. Every one has the same password: Password123!
 *   (emails: usuario001@example.com ... usuario020@example.com)
 * - Shifts every date so that "the moment the dataset was generated" becomes NOW:
 *   open auctions are really open, closed ones closed recently.
 * - Safe to run several times (existing rows are skipped).
 *
 * This is DATA loading, not business logic: it writes rows directly. Anything
 * created later goes through the domain rules.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/infrastructure/database/prisma.client";
import type { AuctionStatus } from "../src/infrastructure/database/generated/prisma/client";
import { auctions } from "./seed-data/auctions.mockdata";

const DEV_PASSWORD = "Password123!";

const STATUS_MAP: Record<string, AuctionStatus> = {
  ABIERTA: "OPEN",
  CANCELADA: "CANCELLED",
  CERRADA: "CLOSED",
  DESIERTA: "DESERTED",
};

/** The dataset has no timezone in its dates; read them as UTC. */
const parseUtc = (value: string): number => new Date(`${value}Z`).getTime();

const main = async (): Promise<void> => {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not defined (check your .env).");
  }
  const prisma = createPrismaClient(url);

  try {
    // 1) Shift: the newest bid of the dataset becomes "now".
    const newestBid = Math.max(...auctions.flatMap((auction) => auction.bids.map((bid) => parseUtc(bid.created_at))));
    const shiftMs = Date.now() - newestBid;
    const shifted = (value: string): Date => new Date(parseUtc(value) + shiftMs);

    // 2) Users: every id that appears as seller or bidder.
    const userIds = [
      ...new Set(auctions.flatMap((auction) => [auction.seller_id, ...auction.bids.map((bid) => bid.bidder_id)])),
    ].sort();
    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
    const users = await prisma.user.createMany({
      data: userIds.map((id) => {
        const number = id.replace("usr_", "");
        return { id, name: `Usuario ${number}`, email: `usuario${number}@example.com`, passwordHash };
      }),
      skipDuplicates: true,
    });

    // 3) Auctions and bids.
    let openButOverdue = 0;
    const auctionRows = auctions.map((auction) => {
      const status = STATUS_MAP[auction.status];
      if (status === undefined) {
        throw new Error(`Unknown status in dataset: ${auction.status}`);
      }
      const closingDate = shifted(auction.closing_date);
      if (status === "OPEN" && closingDate.getTime() <= Date.now()) {
        openButOverdue += 1; // it will be closed lazily the first time somebody reads it
      }

      // RN-13: the winner is always the highest bidder (the raw dataset is not consistent about it).
      const highest = [...auction.bids].sort((a, b) => b.amount - a.amount)[0];
      return {
        id: auction.id,
        itemName: auction.item_name,
        description: auction.description,
        category: auction.category,
        sellerId: auction.seller_id,
        basePrice: BigInt(auction.base_price),
        minIncrement: BigInt(auction.min_increment),
        publishedAt: shifted(auction.published_at),
        closingDate,
        status,
        winnerId: status === "CLOSED" && highest ? highest.bidder_id : null,
      };
    });

    const createdAuctions = await prisma.auction.createMany({ data: auctionRows, skipDuplicates: true });
    const createdBids = await prisma.bid.createMany({
      data: auctions.flatMap((auction) =>
        auction.bids.map((bid) => ({
          id: bid.id,
          auctionId: auction.id,
          bidderId: bid.bidder_id,
          amount: BigInt(bid.amount),
          createdAt: shifted(bid.created_at),
        }))
      ),
      skipDuplicates: true,
    });

    console.log(
      `Seed done: ${users.count} users, ${createdAuctions.count} auctions, ${createdBids.count} bids created ` +
        `(${openButOverdue} open auctions are already overdue and will close lazily on first read).`
    );
    console.log(`Login with usuario001@example.com / ${DEV_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
