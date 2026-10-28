import { Request, Response } from "express";
import { OrderService } from "../../domain/services/order.service";
import { getAuthUserId } from "../middlewares/auth.middleware";
import { success, toOrderResponse } from "../presenters/presenters";

export const createOrderController = (orderService: OrderService) => ({
  /** GET /orders: payment orders of the auctions the user won. */
  listMine: async (req: Request, res: Response): Promise<void> => {
    const orders = await orderService.listMyOrders(getAuthUserId(req));
    res.status(200).json(success(orders.map(toOrderResponse)));
  },

  getById: async (req: Request<{ order_id: string }>, res: Response): Promise<void> => {
    const order = await orderService.getOrderById(req.params.order_id, getAuthUserId(req));
    res.status(200).json(success(toOrderResponse(order)));
  },
});

export type OrderController = ReturnType<typeof createOrderController>;
