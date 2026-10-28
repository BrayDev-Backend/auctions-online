import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate.middleware";
import { loginSchema, registerSchema } from "../validators/schemas";

export const createAuthRoutes = (controller: AuthController): Router => {
  const router = Router();
  router.post("/register", validateBody(registerSchema), controller.register);
  router.post("/login", validateBody(loginSchema), controller.login);
  return router;
};
