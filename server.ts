import express, { Application } from "express";
import auctionsRouter from "./routes/auctions_routes";

const PORT: number = 3000;

const app: Application = express();

app.use(express.json());

app.use("/api", auctionsRouter);

app.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}!`);
});