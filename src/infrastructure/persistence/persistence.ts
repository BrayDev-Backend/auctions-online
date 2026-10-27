import { IAuctionRepository } from "../../domain/ports/auction.repository.port";
import { IOrderRepository } from "../../domain/ports/order.repository.port";
import { IUserRepository } from "../../domain/ports/user.repository.port";
import { IWebhookEventRepository } from "../../domain/ports/webhook-event.repository.port";
import { createPrismaClient } from "../database/prisma.client";
import { InMemoryAuctionRepository } from "../repositories/in-memory/in-memory-auction.repository";
import { InMemoryOrderRepository } from "../repositories/in-memory/in-memory-order.repository";
import { InMemoryUserRepository } from "../repositories/in-memory/in-memory-user.repository";
import { InMemoryWebhookEventRepository } from "../repositories/in-memory/in-memory-webhook-event.repository";
import { PrismaAuctionRepository } from "../repositories/prisma/prisma-auction.repository";
import { PrismaOrderRepository } from "../repositories/prisma/prisma-order.repository";
import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository";
import { PrismaWebhookEventRepository } from "../repositories/prisma/prisma-webhook-event.repository";

/**
 * Everything the application needs from "a database", as ports.
 * Choosing PostgreSQL or memory happens ONLY here (RNF-06).
 */
export interface IPersistence {
  userRepository: IUserRepository;
  auctionRepository: IAuctionRepository;
  orderRepository: IOrderRepository;
  webhookEventRepository: IWebhookEventRepository;
  /** Releases connections. */
  close(): Promise<void>;
}

export const createInMemoryPersistence = (): IPersistence => ({
  userRepository: new InMemoryUserRepository(),
  auctionRepository: new InMemoryAuctionRepository(),
  orderRepository: new InMemoryOrderRepository(),
  webhookEventRepository: new InMemoryWebhookEventRepository(),
  close: async () => undefined,
});

/** Connects to PostgreSQL and fails fast if the database is unreachable. */
export const createPostgresPersistence = async (databaseUrl: string): Promise<IPersistence> => {
  const prisma = createPrismaClient(databaseUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    await prisma.$disconnect();
    throw new Error(
      `Cannot connect to PostgreSQL. Is the container running (docker compose up -d) and DATABASE_URL correct? ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return {
    userRepository: new PrismaUserRepository(prisma),
    auctionRepository: new PrismaAuctionRepository(prisma),
    orderRepository: new PrismaOrderRepository(prisma),
    webhookEventRepository: new PrismaWebhookEventRepository(prisma),
    close: () => prisma.$disconnect(),
  };
};
