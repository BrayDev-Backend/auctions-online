import { Request, Response } from "express";
import { UserService } from "../../domain/services/user.service";
import { getAuthUserId } from "../middlewares/auth.middleware";
import { success, toProfileResponse } from "../presenters/presenters";

export const createUserController = (userService: UserService) => ({
  /** GET /users/me: the profile always belongs to the token's owner. */
  getMe: async (req: Request, res: Response): Promise<void> => {
    const user = await userService.getUserProfile(getAuthUserId(req));
    res.status(200).json(success(toProfileResponse(user)));
  },
});

export type UserController = ReturnType<typeof createUserController>;
