import { NextFunction, Request, Response } from "express";
import { Counter, Histogram } from "prom-client";

export function buildHttpMetricsMiddleware(
  requestsTotal: Counter<"method" | "route" | "status_code">,
  requestDuration: Histogram<"method" | "route" | "status_code">
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const end = requestDuration.startTimer();

    res.on("finish", () => {
      let route: string;
      if (req.route) {
        const cleanUrl = req.originalUrl.split("?")[0];
        const routePath = req.route.path as string;
        route = routePath === "/"
          ? cleanUrl
          : cleanUrl.replace(new RegExp(routePath.replace(/:\w+/g, "[^/]+") + "$"), routePath);
      } else {
        route = req.path;
      }
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
