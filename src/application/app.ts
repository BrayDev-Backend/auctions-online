import cors from "cors";
import express, { Application } from "express";
import { ITokenService } from "../domain/ports/token-service.port";
import { AuctionService } from "../domain/services/auction.service";
import { AuthService } from "../domain/services/auth.service";
import { OrderService } from "../domain/services/order.service";
import { UserService } from "../domain/services/user.service";
import { WebhookService } from "../domain/services/webhook.service";
import { createAuctionController } from "./controllers/auction.controller";
import { createAuthController } from "./controllers/auth.controller";
import { createOrderController } from "./controllers/order.controller";
import { createUserController } from "./controllers/user.controller";
import { createWebhookController } from "./controllers/webhook.controller";
import { createAuthMiddleware } from "./middlewares/auth.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { createApiRoutes } from "./routes/index.routes";
import { createWebhookRoutes } from "./routes/webhook.routes";

export const API_PREFIX = "/api/v1";

/** Everything the HTTP layer needs. Received from the composition root. */
export interface IAppDependencies {
  authService: AuthService;
  userService: UserService;
  auctionService: AuctionService;
  orderService: OrderService;
  webhookService: WebhookService;
  tokenService: ITokenService;
  corsOrigin: string;
}

export const createApp = (deps: IAppDependencies): Application => {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: deps.corsOrigin === "*" ? true : deps.corsOrigin.split(",") }));

  // Must come BEFORE express.json(): the webhook needs the untouched raw body (RN-18).
  app.use(
    `${API_PREFIX}/webhooks`,
    createWebhookRoutes(createWebhookController(deps.webhookService), deps.webhookService)
  );

  app.use(express.json({ limit: "100kb" }));

  app.use(
    API_PREFIX,
    createApiRoutes(
      {
        auction: createAuctionController(deps.auctionService),
        auth: createAuthController(deps.authService),
        order: createOrderController(deps.orderService),
        user: createUserController(deps.userService),
      },
      createAuthMiddleware(deps.tokenService)
    )
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
