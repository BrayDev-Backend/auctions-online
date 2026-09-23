import { Router } from "express";
import auctionRoutes from "./auction.routes";
import authRoutes from "./auth.routes";
import paymentRoutes from "./payment.routes";
import userRoutes from "./user.routes";

const routes = Router();

routes.use("/auction", auctionRoutes);
routes.use("/auth", authRoutes);
routes.use("/payment", paymentRoutes);
routes.use("/user", userRoutes);

export default routes;