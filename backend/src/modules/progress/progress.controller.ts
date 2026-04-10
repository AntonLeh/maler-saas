import { Request, Response, NextFunction } from "express";
import { getProgressByOrderId, createProgress } from "./progress.service";

export async function getOrderProgress(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const progress = await getProgressByOrderId(req.params.id);
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function postProgress(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const progress = await createProgress(req.body);
    res.status(201).json(progress);
  } catch (error) {
    next(error);
  }
}