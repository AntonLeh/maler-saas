import { Request, Response, NextFunction } from "express";
import { getAllOrders, getOrderById, createOrder } from "./orders.service";

export async function getOrders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orders = await getAllOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
}

export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    const order = await getOrderById(id);
    res.json(order);
  } catch (error) {
    next(error);
  }
}

export async function postOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const order = await createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}