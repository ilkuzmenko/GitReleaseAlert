import { Counter } from "prom-client";
import { ExternalApiError } from "../domain/errors";
import { RepositoriesRepository } from "../infra/db/repository/repositories-repository";
import { SubscriptionsRepository } from "../infra/db/repository/subscriptions-repository";
import { GithubClientPort } from "../domain/ports/github-client";
import { EmailNotifier } from "../infra/notifier/email-notifier";

type ScannerMetrics = {
  runsTotal: Counter<"result">;
  notificationsSentTotal: Counter<string>;
};

export class ReleaseScanner {
  private nextAllowedRunAt = 0;

  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly githubClient: GithubClientPort,
    private readonly emailNotifier: EmailNotifier,
    private readonly metrics?: ScannerMetrics
  ) {}

  async runOnce(): Promise<void> {
    if (Date.now() < this.nextAllowedRunAt) {
      return;
    }

    const repositories = await this.repositoriesRepository.getRepositoriesWithActiveSubscriptions();
    let hasErrors = false;

    for (const repository of repositories) {
      try {
        const latestRelease = await this.githubClient.getLatestRelease(repository.owner, repository.name);
        if (!latestRelease) {
          continue;
        }

        if (repository.lastSeenTag === latestRelease.tagName) {
          continue;
        }

        await this.repositoriesRepository.updateLastSeen(repository.id, latestRelease);
        const emails = await this.subscriptionsRepository.getActiveEmailsByRepositoryId(repository.id);
        for (const email of emails) {
          try {
            await this.emailNotifier.notifyNewRelease(email, repository.fullName, latestRelease.tagName, latestRelease.htmlUrl);
            this.metrics?.notificationsSentTotal.inc();
          } catch (emailError) {
            console.error("Failed to send email to", email, "for", repository.fullName, emailError);
          }
        }
      } catch (error) {
        if (error instanceof ExternalApiError && error.statusCode === 429) {
          const retryAfterMs = (error.retryAfterSeconds ?? 60) * 1000;
          this.nextAllowedRunAt = Date.now() + retryAfterMs;
          this.metrics?.runsTotal.inc({ result: "rate_limited" });
          return;
        }
        console.error("Scanner failed for repository", repository.fullName, error);
        hasErrors = true;
      }
    }

    this.metrics?.runsTotal.inc({ result: hasErrors ? "error" : "ok" });
  }
}

export function startScannerLoop(scanner: ReleaseScanner, intervalMs: number): NodeJS.Timeout {
  return setInterval(() => {
    scanner.runOnce().catch((error) => {
      console.error("Scanner run failed", error);
    });
  }, intervalMs);
}
