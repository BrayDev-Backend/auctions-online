import { RequestHandler, Router } from "express";
import { AuctionController } from "../controllers/auction.controller";
import { validateBody } from "../middlewares/validate.middleware";
import { createAuctionSchema, placeBidSchema } from "../validators/schemas";

export const createAuctionRoutes = (controller: AuctionController, authenticate: RequestHandler): Router => {
  const router = Router();

  // Public: anybody can browse auctions and the public bid history (RN-23).
  router.get("/", controller.list);
  router.get("/:auction_id", controller.getById);

  // Protected: need a valid JWT.
  router.post("/", authenticate, validateBody(createAuctionSchema), controller.create);
  router.patch("/:auction_id/cancel", authenticate, controller.cancel);
  router.post("/:auction_id/bids", authenticate, validateBody(placeBidSchema), controller.placeBid);

  return router;
};
