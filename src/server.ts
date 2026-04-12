import { buildApp } from "./app";
import { config } from "./config";
import { SubscriptionService } from "./domain/subscriptions/subscription-service";
import { pool } from "./infra/db/client";
import { RepositoriesRepository } from "./infra/db/repository/repositories-repository";
import { runMigrations } from "./infra/db/run-migrations";
import { SubscriptionsRepository } from "./infra/db/repository/subscriptions-repository";
import { CachedGithubClient } from "./infra/cache/cached-github-client";
import { redisClient } from "./infra/cache/redis-client";
import { GithubClient } from "./infra/github/github-client";
import {
  githubApiRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestsTotal,
  registry,
  scannerNotificationsSentTotal,
  scannerRunsTotal
} from "./infra/metrics/registry";
import { SmtpEmailNotifier } from "./infra/notifier/email-notifier";
import { ReleaseScanner, startScannerLoop } from "./jobs/release-scanner";
import { buildGrpcServer, startGrpcServer } from "./grpc/server";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrationsWithRetry(maxAttempts = 20, delayMs = 1500): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runMigrations(pool);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Database not ready yet (attempt ${attempt}/${maxAttempts}), retrying...`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function bootstrap(): Promise<void> {
  await redisClient.connect();
  await runMigrationsWithRetry();

  const repositoriesRepository = new RepositoriesRepository(pool);
  const subscriptionsRepository = new SubscriptionsRepository(pool);
  const githubClient = new GithubClient(config.githubToken, githubApiRequestsTotal);
  const cachedGithubClient = new CachedGithubClient(githubClient, redisClient);
  const emailNotifier = new SmtpEmailNotifier({
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser,
    pass: config.smtpPass,
    from: config.smtpFrom
  });

  const subscriptionService = new SubscriptionService(repositoriesRepository, subscriptionsRepository, cachedGithubClient);
  const app = buildApp(subscriptionService, registry, httpRequestsTotal, httpRequestDurationSeconds, config.apiKey);

  const scanner = new ReleaseScanner(
    repositoriesRepository,
    subscriptionsRepository,
    cachedGithubClient,
    emailNotifier,
    { runsTotal: scannerRunsTotal, notificationsSentTotal: scannerNotificationsSentTotal }
  );
  startScannerLoop(scanner, config.scanIntervalMs);
  await scanner.runOnce();

  const grpcServer = buildGrpcServer(subscriptionService, config.apiKey);
  startGrpcServer(grpcServer, config.grpcPort);

  app.listen(config.port, () => {
    console.log(`Server listening on :${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap app", error);
  process.exit(1);
});
