import { NextFunction, Request, Response } from "express";
import { Counter, Histogram } from "prom-client";

export function buildHttpMetricsMiddleware(
  requestsTotal: Counter<"method" | "route" | "status_code">,
  requestDuration: Histogram<"method" | "route" | "status_code">
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const end = requestDuration.startTimer();

    res.on("finish", () => {
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode)
      };
      requestsTotal.inc(labels);
      end(labels);
    });

    next();
  };
}
