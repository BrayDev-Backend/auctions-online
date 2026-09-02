import express, { Application } from "express";

const PORT: number = 3000;

const app: Application = express();

app.use(express.json());

app.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}!`);
});