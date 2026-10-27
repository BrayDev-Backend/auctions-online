import { Auction } from "../../../domain/entities/auction.entity";
import { Bid } from "../../../domain/entities/bid.entity";
import { PaymentOrder } from "../../../domain/entities/order.entity";
import { User } from "../../../domain/entities/user.entity";
import { Email } from "../../../domain/value-objects/email.vo";
import { Money } from "../../../domain/value-objects/money.vo";
import type { Prisma } from "../../database/generated/prisma/client";

/**
 * Translators between Prisma rows (database shape) and domain entities.
 * This is the ONLY place that knows both worlds — e.g. that money is a BigInt
 * column in Postgres but a Money value object in the domain.
 */

export type AuctionRow = Prisma.AuctionGetPayload<{ include: { bids: true } }>;
export type BidRow = Prisma.BidGetPayload<object>;
export type UserRow = Prisma.UserGetPayload<object>;
export type OrderRow = Prisma.PaymentOrderGetPayload<object>;

const toMoney = (value: bigint): Money => Money.create(Number(value));

export const toDomainBid = (row: BidRow): Bid =>
  new Bid({
    id: row.id,
    auctionId: row.auctionId,
    bidderId: row.bidderId,
    amount: toMoney(row.amount),
    createdAt: row.createdAt,
  });

export const toDomainAuction = (row: AuctionRow): Auction =>
  Auction.restore({
    id: row.id,
    itemName: row.itemName,
    description: row.description,
    category: row.category,
    sellerId: row.sellerId,
    basePrice: toMoney(row.basePrice),
    minIncrement: toMoney(row.minIncrement),
    publishedAt: row.publishedAt,
    closingDate: row.closingDate,
    status: row.status,
    winnerId: row.winnerId,
    bids: row.bids.map(toDomainBid),
  });

export const toDomainUser = (row: UserRow): User =>
  new User({
    id: row.id,
    name: row.name,
    email: Email.create(row.email),
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  });

export const toDomainOrder = (row: OrderRow): PaymentOrder =>
  PaymentOrder.restore({
    id: row.id,
    auctionId: row.auctionId,
    winnerId: row.winnerId,
    amount: toMoney(row.amount),
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
  });
