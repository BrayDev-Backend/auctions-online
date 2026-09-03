import { Request, Response } from "express";
import { auctions } from "../data/auctions_mockdata";

export const getAllAuctions = (req: Request, res: Response) => {
    
    const { category } = req.query;

    if (category) {
        const filteredAuctions = auctions.filter(
            (auction) => auction.category === category
        );

        return res.json(filteredAuctions);
    }

    res.json(auctions);

};

export const getAuctionById = (req: Request, res: Response) => {



};

export const createAuction = (req: Request, res: Response) => {



};

export const cancelAuction = (req: Request, res: Response) => {



};

export const placeBid = (req: Request, res: Response) => {



};