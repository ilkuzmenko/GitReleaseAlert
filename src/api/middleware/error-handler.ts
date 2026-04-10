import { NextFunction, Request, Response } from "express";
import { AppError } from "../../domain/errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
    return;
  }

  console.error("Unhandled error", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    }
  });
}
