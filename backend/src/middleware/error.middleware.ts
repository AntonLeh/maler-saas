import { NextFunction, Request, Response } from "express";

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Fehler:", err.message);

  res.status(500).json({
    message: "Interner Serverfehler",
  });
}