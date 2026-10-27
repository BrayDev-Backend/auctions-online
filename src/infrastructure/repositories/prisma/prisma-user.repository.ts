import { User } from "../../../domain/entities/user.entity";
import { EmailAlreadyInUseError } from "../../../domain/errors/domain.error";
import { IUserRepository } from "../../../domain/ports/user.repository.port";
import { Prisma } from "../../database/generated/prisma/client";
import type { PrismaClient } from "../../database/prisma.client";
import { toDomainUser } from "./prisma.mappers";

/** Prisma error code for "unique constraint failed". */
const UNIQUE_VIOLATION = "P2002";

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row === null ? null : toDomainUser(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row === null ? null : toDomainUser(row);
  }

  async create(user: User): Promise<void> {
    try {
      await this.prisma.user.create({
        data: {
          id: user.id,
          name: user.name,
          email: user.email.value,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      // Two simultaneous registrations with the same email: the DB constraint wins (RN-22).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new EmailAlreadyInUseError("This email is already registered.");
      }
      throw error;
    }
  }
}
