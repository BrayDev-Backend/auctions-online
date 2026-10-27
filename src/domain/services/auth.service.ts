import { User } from "../entities/user.entity";
import { EmailAlreadyInUseError, InvalidCredentialsError } from "../errors/domain.error";
import { IPasswordHasher } from "../ports/password-hasher.port";
import { IClock, IIdGenerator } from "../ports/system.port";
import { ITokenService } from "../ports/token-service.port";
import { IUserRepository } from "../ports/user.repository.port";
import { Email } from "../value-objects/email.vo";

export interface IRegisterUserDTO {
  name: string;
  email: string;
  password: string;
}

export interface ILoginUserDTO {
  email: string;
  password: string;
}

export interface IAuthResult {
  token: string;
  user: User;
}

export interface IAuthServiceDeps {
  userRepository: IUserRepository;
  passwordHasher: IPasswordHasher;
  tokenService: ITokenService;
  clock: IClock;
  idGenerator: IIdGenerator;
}

export const createAuthService = (deps: IAuthServiceDeps) => {
  const { userRepository, passwordHasher, tokenService, clock, idGenerator } = deps;

  const issueToken = (user: User): string =>
    tokenService.issue({ userId: user.id, email: user.email.value });

  const registerUser = async (dto: IRegisterUserDTO): Promise<IAuthResult> => {
    const email = Email.create(dto.email);

    // RN-22: unique email (the repository also enforces it with a DB constraint).
    if ((await userRepository.findByEmail(email.value)) !== null) {
      throw new EmailAlreadyInUseError("This email is already registered.");
    }

    // RN-22 / RNF-16: only the hash is stored.
    const user = new User({
      id: idGenerator.generate(),
      name: dto.name.trim(),
      email,
      passwordHash: await passwordHasher.hash(dto.password),
      createdAt: clock.now(),
    });
    await userRepository.create(user);

    return { token: issueToken(user), user };
  };

  const loginUser = async (dto: ILoginUserDTO): Promise<IAuthResult> => {
    const email = Email.create(dto.email);
    const user = await userRepository.findByEmail(email.value);

    // Same error for "unknown email" and "wrong password": don't reveal which emails exist.
    if (user === null || !(await passwordHasher.compare(dto.password, user.passwordHash))) {
      throw new InvalidCredentialsError("Invalid email or password.");
    }

    return { token: issueToken(user), user };
  };

  return { registerUser, loginUser };
};

export type AuthService = ReturnType<typeof createAuthService>;