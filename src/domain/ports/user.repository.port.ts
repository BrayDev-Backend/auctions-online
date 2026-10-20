import { User } from "../entities/user.entity";

/** OUTPUT PORT for users */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  /** email must already be normalized use the Email value object */
  findByEmail(email: string): Promise<User | null>;
  /** Creates the user must throw EmailAlreadyInUseError on a duplicate email (RN-22) */
  create(user: User): Promise<void>;
}
