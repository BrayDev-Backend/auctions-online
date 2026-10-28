import { RequestHandler, Router } from "express";
import { OrderController } from "../controllers/order.controller";

export const createOrderRoutes = (controller: OrderController, authenticate: RequestHandler): Router => {
  const router = Router();
  router.use(authenticate); // every order route is private
  router.get("/", controller.listMine);
  router.get("/:order_id", controller.getById);
  return router;
};
