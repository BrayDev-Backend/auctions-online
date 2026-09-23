import express, { Router } from "express";
import { cancelAuction, createAuction, getAllAuctions, getAuctionById, placeBid } from "../controllers/auction.controller";

const auctionRoutes: Router = express.Router();

auctionRoutes.get("/", getAllAuctions);
auctionRoutes.get("/:auction_id", getAuctionById);
auctionRoutes.post("/", createAuction);
auctionRoutes.patch("/:auction_id/cancel", cancelAuction);
auctionRoutes.post("/:auction_id/bids", placeBid);

export default auctionRoutes;

