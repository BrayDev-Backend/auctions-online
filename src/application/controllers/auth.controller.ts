import { Request, Response } from "express";
import { AuthService } from "../../domain/services/auth.service";
import { success } from "../presenters/presenters";
import { LoginBody, RegisterBody } from "../validators/schemas";

export const createAuthController = (authService: AuthService) => ({
  register: async (req: Request<object, unknown, RegisterBody>, res: Response): Promise<void> => {
    const { token, user } = await authService.registerUser(req.body);
    res.status(201).json(success({ token, user: { id: user.id, name: user.name, email: user.email.value } }));
  },

  login: async (req: Request<object, unknown, LoginBody>, res: Response): Promise<void> => {
    const { token, user } = await authService.loginUser(req.body);
    res.status(200).json(success({ token, user: { id: user.id, name: user.name, email: user.email.value } }));
  },
});

export type AuthController = ReturnType<typeof createAuthController>;
