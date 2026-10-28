import { Request, Response } from "express";
import { AuctionService } from "../../domain/services/auction.service";
import { getAuthUserId } from "../middlewares/auth.middleware";
import { success, toAuctionResponse, toBidResponse } from "../presenters/presenters";
import { parseInput } from "../middlewares/validate.middleware";
import {
  CreateAuctionBody,
  ListAuctionsQuery,
  listAuctionsQuerySchema,
  PlaceBidBody,
} from "../validators/schemas";

type AuctionParams = { auction_id: string };

/**
 * Controllers only deserialize the request, call ONE use case and serialize the
 * answer. No business rule lives here.
 *
 * Express 5 forwards rejected promises to the error middleware automatically,
 * so there is no try/catch/next boilerplate.
 */
export const createAuctionController = (auctionService: AuctionService) => ({
  list: async (req: Request, res: Response): Promise<void> => {
    const query: ListAuctionsQuery = parseInput(listAuctionsQuerySchema, req.query);
    const auctions = await auctionService.listAuctions({
      category: query.category,
      status: query.status,
      sellerId: query.seller_id,
    });
    res.status(200).json(success(auctions.map(toAuctionResponse)));
  },

  getById: async (req: Request<AuctionParams>, res: Response): Promise<void> => {
    const auction = await auctionService.getAuctionById(req.params.auction_id);
    res.status(200).json(success(toAuctionResponse(auction)));
  },

  create: async (req: Request<object, unknown, CreateAuctionBody>, res: Response): Promise<void> => {
    const body = req.body;
    // The seller is always the authenticated user, never a value sent by the client.
    const auction = await auctionService.createAuction(
      {
        itemName: body.item_name,
        description: body.description,
        category: body.category,
        basePrice: body.base_price,
        minIncrement: body.min_increment,
        closingDate: body.closing_date,
      },
      getAuthUserId(req)
    );
    res.status(201).json(success(toAuctionResponse(auction)));
  },

  cancel: async (req: Request<AuctionParams>, res: Response): Promise<void> => {
    const auction = await auctionService.cancelAuction(req.params.auction_id, getAuthUserId(req));
    res.status(200).json(success(toAuctionResponse(auction)));
  },

  placeBid: async (req: Request<AuctionParams, unknown, PlaceBidBody>, res: Response): Promise<void> => {
    // The bidder is always the authenticated user.
    const { auction, bid } = await auctionService.placeBid({
      auctionId: req.params.auction_id,
      bidderId: getAuthUserId(req),
      amount: req.body.amount,
    });
    res.status(201).json(
      success({
        bid: toBidResponse(bid),
        current_highest_bid: auction.highestBid?.amount.value ?? null,
      })
    );
  },
});

export type AuctionController = ReturnType<typeof createAuctionController>;
