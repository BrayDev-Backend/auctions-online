/** OUTPUT PORT password hashing (RNF-16) implemented with bcrypt in infrastructure */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  compare(plainPassword: string, passwordHash: string): Promise<boolean>;
}
