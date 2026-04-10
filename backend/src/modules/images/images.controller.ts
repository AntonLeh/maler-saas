import { Request, Response, NextFunction } from "express";
import { getImagesByOrderId } from "./images.service";

export async function getOrderImages(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const images = await getImagesByOrderId(req.params.id);
    res.json(images);
  } catch (error) {
    next(error);
  }
}