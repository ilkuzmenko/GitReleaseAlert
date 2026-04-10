import express from "express";
import path from "node:path";
import { Counter, Histogram, Registry } from "prom-client";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { errorHandler } from "./api/middleware/error-handler";
import { buildHttpMetricsMiddleware } from "./api/middleware/http-metrics";
import { buildMetricsRouter } from "./api/routes/metrics";
import { buildSubscriptionsRouter } from "./api/routes/subscriptions";
import { SubscriptionService } from "./domain/subscriptions/subscription-service";

export function buildApp(
  subscriptionService: SubscriptionService,
  registry: Registry,
  httpRequestsTotal: Counter<"method" | "route" | "status_code">,
  httpRequestDurationSeconds: Histogram<"method" | "route" | "status_code">
): express.Express {
  const app = express();
  const openApiPath = path.join(process.cwd(), "openapi.yaml");
  const openApiDocument = YAML.load(openApiPath);

  app.use(express.static(path.join(process.cwd(), "public")));
  app.use(express.json());
  app.use(buildHttpMetricsMiddleware(httpRequestsTotal, httpRequestDurationSeconds));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use("/metrics", buildMetricsRouter(registry));
  app.use("/subscriptions", buildSubscriptionsRouter(subscriptionService));
  app.use(errorHandler);

  return app;
}
