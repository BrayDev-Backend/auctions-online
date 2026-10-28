import { RequestHandler, Router } from "express";
import { UserController } from "../controllers/user.controller";

export const createUserRoutes = (controller: UserController, authenticate: RequestHandler): Router => {
  const router = Router();
  router.get("/me", authenticate, controller.getMe);
  return router;
};
