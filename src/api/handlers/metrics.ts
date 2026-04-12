import { Router } from "express";
import { Registry } from "prom-client";

export function buildMetricsRouter(registry: Registry): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const metrics = await registry.metrics();
      res.set("Content-Type", registry.contentType).send(metrics);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
