import { PaymentOrder } from "../../../domain/entities/order.entity";
import { IOrderRepository } from "../../../domain/ports/order.repository.port";
import type { PrismaClient } from "../../database/prisma.client";
import { toDomainOrder } from "./prisma.mappers";

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<PaymentOrder | null> {
    const row = await this.prisma.paymentOrder.findUnique({ where: { id } });
    return row === null ? null : toDomainOrder(row);
  }

  async findByAuctionId(auctionId: string): Promise<PaymentOrder | null> {
    const row = await this.prisma.paymentOrder.findUnique({ where: { auctionId } });
    return row === null ? null : toDomainOrder(row);
  }

  async findByWinnerId(winnerId: string): Promise<PaymentOrder[]> {
    const rows = await this.prisma.paymentOrder.findMany({
      where: { winnerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainOrder);
  }

  async save(order: PaymentOrder): Promise<void> {
    const mutable = { status: order.status, paidAt: order.paidAt };
    await this.prisma.paymentOrder.upsert({
      where: { id: order.id },
      update: mutable,
      create: {
        id: order.id,
        auctionId: order.auctionId, // UNIQUE in the DB: a 2nd order for the same auction fails (RN-16)
        winnerId: order.winnerId,
        amount: BigInt(order.amount.value),
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        ...mutable,
      },
    });
  }
}
