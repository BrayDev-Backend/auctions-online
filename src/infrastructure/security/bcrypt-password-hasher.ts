import bcrypt from "bcryptjs";
import { IPasswordHasher } from "../../domain/ports/password-hasher.port";

/** bcrypt adapter for the IPasswordHasher port (RNF-16). */
export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly saltRounds: number) {}

  hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.saltRounds);
  }

  compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
