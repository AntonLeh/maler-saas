import { Request, Response, NextFunction } from "express";
import { getAllCustomers, createCustomer } from "./customers.service";

export async function getCustomers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customers = await getAllCustomers();
    res.json(customers);
  } catch (error) {
    next(error);
  }
}

export async function postCustomer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const customer = await createCustomer(req.body);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
}