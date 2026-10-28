import { RequestHandler, Router } from "express";
import { AuctionController } from "../controllers/auction.controller";
import { AuthController } from "../controllers/auth.controller";
import { OrderController } from "../controllers/order.controller";
import { UserController } from "../controllers/user.controller";
import { createAuctionRoutes } from "./auction.routes";
import { createAuthRoutes } from "./auth.routes";
import { createOrderRoutes } from "./order.routes";
import { createUserRoutes } from "./user.routes";

export interface IApiControllers {
  auction: AuctionController;
  auth: AuthController;
  order: OrderController;
  user: UserController;
}

/**
 * JSON API under /api/v1. (The webhook router is mounted separately in app.ts
 * because it needs the raw body instead of parsed JSON.)
 */
export const createApiRoutes = (controllers: IApiControllers, authenticate: RequestHandler): Router => {
  const routes = Router();

  routes.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, data: { status: "up" } });
  });

  routes.use("/auctions", createAuctionRoutes(controllers.auction, authenticate));
  routes.use("/auth", createAuthRoutes(controllers.auth));
  routes.use("/orders", createOrderRoutes(controllers.order, authenticate));
  routes.use("/users", createUserRoutes(controllers.user, authenticate));

  return routes;
};
