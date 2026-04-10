import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [registry]
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry]
});

export const scannerRunsTotal = new Counter({
  name: "scanner_runs_total",
  help: "Total number of release scanner runs",
  labelNames: ["result"],
  registers: [registry]
});

export const scannerNotificationsSentTotal = new Counter({
  name: "scanner_notifications_sent_total",
  help: "Total number of email notifications sent by the scanner",
  registers: [registry]
});

export const githubApiRequestsTotal = new Counter({
  name: "github_api_requests_total",
  help: "Total number of GitHub API requests",
  labelNames: ["status"],
  registers: [registry]
});
