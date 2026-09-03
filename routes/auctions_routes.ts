import express, { Router } from "express";
import { getAllAuctions, getAuctionById } from "../controllers/auctions_handlers";

const auctionsRouter: Router = express.Router();

auctionsRouter.get("/auctions", getAllAuctions);
auctionsRouter.get("/auctions/:auction_id", getAuctionById);


export default auctionsRouter;

