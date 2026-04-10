import { describe, expect, it, vi } from "vitest";
import { ExternalApiError } from "../domain/errors";
import { ReleaseScanner } from "./release-scanner";

function makeScanner(overrides: {
  lastSeenTag?: string;
  latestTag?: string | null;
  githubError?: Error;
  metrics?: { runsTotal: any; notificationsSentTotal: any };
}) {
  const repositoriesRepository = {
    getRepositoriesWithActiveSubscriptions: vi.fn().mockResolvedValue([
      { id: 1, owner: "renovatebot", name: "renovate", fullName: "renovatebot/renovate", lastSeenTag: overrides.lastSeenTag ?? "v1" }
    ]),
    updateLastSeen: vi.fn().mockResolvedValue(undefined)
  };
  const subscriptionsRepository = {
    getActiveEmailsByRepositoryId: vi.fn().mockResolvedValue(["dev@example.com"])
  };
  const githubClient = {
    getLatestRelease: overrides.githubError
      ? vi.fn().mockRejectedValue(overrides.githubError)
      : vi.fn().mockResolvedValue(
          overrides.latestTag === null
            ? null
            : { tagName: overrides.latestTag ?? "v2", publishedAt: null, htmlUrl: "https://example.com" }
        )
  };
  const notifier = { notifyNewRelease: vi.fn().mockResolvedValue(undefined) };

  const scanner = new ReleaseScanner(
    repositoriesRepository as any,
    subscriptionsRepository as any,
    githubClient as any,
    notifier as any,
    overrides.metrics
  );

  return { scanner, repositoriesRepository, githubClient, notifier };
}

describe("ReleaseScanner", () => {
  it("sends notification only for new release tag", async () => {
    const { scanner, repositoriesRepository, notifier } = makeScanner({ lastSeenTag: "v1", latestTag: "v2" });

    await scanner.runOnce();

    expect(repositoriesRepository.updateLastSeen).toHaveBeenCalledTimes(1);
    expect(notifier.notifyNewRelease).toHaveBeenCalledTimes(1);
  });

  it("skips notifications when tag did not change", async () => {
    const { scanner, repositoriesRepository, notifier } = makeScanner({ lastSeenTag: "v2", latestTag: "v2" });

    await scanner.runOnce();

    expect(repositoriesRepository.updateLastSeen).not.toHaveBeenCalled();
    expect(notifier.notifyNewRelease).not.toHaveBeenCalled();
  });

  it("backs off when GitHub returns 429", async () => {
    const { scanner, githubClient } = makeScanner({
      githubError: new ExternalApiError("rate limit", 429, "GITHUB_RATE_LIMIT", 120)
    });

    await scanner.runOnce();
    await scanner.runOnce();

    expect(githubClient.getLatestRelease).toHaveBeenCalledTimes(1);
  });

  it("increments ok counter after successful scan", async () => {
    const runsTotal = { inc: vi.fn() };
    const notificationsSentTotal = { inc: vi.fn() };
    const { scanner } = makeScanner({ lastSeenTag: "v1", latestTag: "v2", metrics: { runsTotal, notificationsSentTotal } });

    await scanner.runOnce();

    expect(runsTotal.inc).toHaveBeenCalledWith({ result: "ok" });
    expect(notificationsSentTotal.inc).toHaveBeenCalledTimes(1);
  });

  it("increments rate_limited counter on 429", async () => {
    const runsTotal = { inc: vi.fn() };
    const notificationsSentTotal = { inc: vi.fn() };
    const { scanner } = makeScanner({
      githubError: new ExternalApiError("rate limit", 429, "GITHUB_RATE_LIMIT", 60),
      metrics: { runsTotal, notificationsSentTotal }
    });

    await scanner.runOnce();

    expect(runsTotal.inc).toHaveBeenCalledWith({ result: "rate_limited" });
    expect(notificationsSentTotal.inc).not.toHaveBeenCalled();
  });

  it("skips scan when repo has no releases", async () => {
    const { scanner, repositoriesRepository, notifier } = makeScanner({ latestTag: null });

    await scanner.runOnce();

    expect(repositoriesRepository.updateLastSeen).not.toHaveBeenCalled();
    expect(notifier.notifyNewRelease).not.toHaveBeenCalled();
  });
});
