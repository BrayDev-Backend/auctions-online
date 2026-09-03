import express, { Router } from "express";
import { cancelAuction, createAuction, getAllAuctions, getAuctionById, placeBid } from "../controllers/auctions_handlers";

const auctionsRouter: Router = express.Router();

auctionsRouter.get("/auctions", getAllAuctions);
auctionsRouter.get("/auctions/:auction_id", getAuctionById);
auctionsRouter.post("/auctions", createAuction);
auctionsRouter.patch("/auctions/:auction_id/cancel", cancelAuction);
auctionsRouter.post("/auctions/:auction_id/bids", placeBid);

export default auctionsRouter;

