import { User } from "../../../domain/entities/user.entity";
import { EmailAlreadyInUseError } from "../../../domain/errors/domain.error";
import { IUserRepository } from "../../../domain/ports/user.repository.port";

export class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email.value === email) ?? null;
  }

  async create(user: User): Promise<void> {
    if ((await this.findByEmail(user.email.value)) !== null) {
      throw new EmailAlreadyInUseError("This email is already registered.");
    }
    this.users.set(user.id, user);
  }
}
