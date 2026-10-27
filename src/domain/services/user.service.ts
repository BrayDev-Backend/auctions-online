import { User } from "../entities/user.entity";
import { UserNotFoundError } from "../errors/domain.error";
import { IUserRepository } from "../ports/user.repository.port";

export interface IUserServiceDeps {
  userRepository: IUserRepository;
}

export const createUserService = (deps: IUserServiceDeps) => {
  const { userRepository } = deps;

  /** Profile of the authenticated user (their own data, so the email can be shown). */
  const getUserProfile = async (userId: string): Promise<User> => {
    const user = await userRepository.findById(userId);
    if (user === null) {
      throw new UserNotFoundError("User not found.");
    }
    return user;
  };

  return { getUserProfile };
};

export type UserService = ReturnType<typeof createUserService>;