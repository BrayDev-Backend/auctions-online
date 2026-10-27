import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Creates the ONE PrismaClient used by the whole process (each client owns a
 * connection pool). Prisma 7 talks to PostgreSQL through the `pg` driver adapter.
 */
export const createPrismaClient = (connectionString: string): PrismaClient => {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
};

export type { PrismaClient };
