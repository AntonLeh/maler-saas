import { Request, Response, NextFunction } from "express";
import { getImagesByOrderId } from "./images.service";

export async function getOrderImages(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    const images = await getImagesByOrderId(id);
    res.json(images);
  } catch (error) {
    next(error);
  }
}