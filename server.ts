import express, { Application } from "express";
import dotenv from "dotenv";
import { errorHandler } from "./src/application/middlewares/error.middleware";
import routes from "./src/application/routes/index.routes";

dotenv.config();

const PORT: number = Number(process.env.PORT) || 3000;

const app: Application = express();

app.use(express.json());

app.use("/api/v1", routes);

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}!`);
});