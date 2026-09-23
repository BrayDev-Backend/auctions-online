import express, { Application } from "express";
import dotenv from "dotenv";
import auctionsRouter from "./src/application/routes/auctions_routes";
import authRouter from "./src/application/routes/auth_routes";
import usersRouter from "./src/application/routes/users_routes";
import paymentsRouter from "./src/application/routes/payments_routes";
import { errorHandler } from "./src/application/middlewares/error_handler";

dotenv.config();

const PORT: number = Number(process.env.PORT) || 3000;

const app: Application = express();

app.use(express.json());

app.use("/api/v1", auctionsRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1", usersRouter);
app.use("/api/v1", paymentsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}!`);
});