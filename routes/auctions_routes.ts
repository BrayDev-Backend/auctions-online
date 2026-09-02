import express, { Router } from "express";
import { getAllAuctions } from "../controllers/auctions_handlers";

const auctionsRouter: Router = express.Router();

auctionsRouter.get("/auctions", getAllAuctions);

export default auctionsRouter;

