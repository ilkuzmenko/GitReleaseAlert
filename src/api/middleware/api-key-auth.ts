import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../domain/errors";

export function buildApiKeyMiddleware(apiKey: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!apiKey) {
      next();
      return;
    }
    if (req.headers["x-api-key"] !== apiKey) {
      next(new UnauthorizedError());
      return;
    }
    next();
  };
}
