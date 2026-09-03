import express, { Application } from "express";
import dotenv from "dotenv";
import auctionsRouter from "./routes/auctions_routes";
import authRouter from "./routes/auth_routes";
import usersRouter from "./routes/users_routes";
import paymentsRouter from "./routes/payments_routes";

dotenv.config();

const PORT: number = Number(process.env.PORT) || 3000;

const app: Application = express();

app.use(express.json());

app.use("/api/v1", auctionsRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1", usersRouter);
app.use("/api/v1", paymentsRouter);

app.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}!`);
});