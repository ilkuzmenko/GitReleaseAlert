import { Counter } from "prom-client";
import { ExternalApiError, NotFoundError } from "../../domain/errors";
import { ReleaseInfo } from "../../domain/models";
import { GithubClientPort } from "../../domain/ports/github-client";

type GithubRepoResponse = {
  full_name: string;
};

type GithubReleaseResponse = {
  tag_name: string;
  published_at: string | null;
  html_url: string;
};

export class GithubClient implements GithubClientPort {
  private readonly baseUrl = "https://api.github.com";

  constructor(
    private readonly token = "",
    private readonly requestsTotal?: Counter<"status">
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
      }
    });

    if (response.status === 404) {
      this.requestsTotal?.inc({ status: "404" });
      throw new NotFoundError("Repository not found");
    }

    if (response.status === 401) {
      this.requestsTotal?.inc({ status: "401" });
      throw new ExternalApiError("GitHub API token is invalid", 401, "GITHUB_UNAUTHORIZED");
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const resetAt = Number(response.headers.get("x-ratelimit-reset"));
      const nowSec = Math.floor(Date.now() / 1000);
      const resetWait = Number.isFinite(resetAt) ? Math.max(resetAt - nowSec, 0) : NaN;
      const retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : Number.isFinite(resetWait) ? resetWait : null;
      this.requestsTotal?.inc({ status: "429" });
      throw new ExternalApiError("GitHub API rate limit reached", 429, "GITHUB_RATE_LIMIT", retryAfterSeconds);
    }

    if (response.status === 403) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        const resetAt = Number(response.headers.get("x-ratelimit-reset"));
        const nowSec = Math.floor(Date.now() / 1000);
        const retryAfterSeconds = Number.isFinite(resetAt) ? Math.max(resetAt - nowSec, 0) : null;
        this.requestsTotal?.inc({ status: "429" });
        throw new ExternalApiError("GitHub API rate limit reached", 429, "GITHUB_RATE_LIMIT", retryAfterSeconds);
      }
      this.requestsTotal?.inc({ status: "403" });
      throw new ExternalApiError("GitHub API access forbidden", 403, "GITHUB_FORBIDDEN");
    }

    if (!response.ok) {
      this.requestsTotal?.inc({ status: String(response.status) });
      throw new ExternalApiError(`GitHub API failed with status ${response.status}`);
    }

    this.requestsTotal?.inc({ status: "200" });
    return (await response.json()) as T;
  }

  async assertRepositoryExists(owner: string, repo: string): Promise<void> {
    await this.request<GithubRepoResponse>(`/repos/${owner}/${repo}`);
  }

  async getLatestRelease(owner: string, repo: string): Promise<ReleaseInfo | null> {
    try {
      const release = await this.request<GithubReleaseResponse>(`/repos/${owner}/${repo}/releases/latest`);
      return {
        tagName: release.tag_name,
        publishedAt: release.published_at,
        htmlUrl: release.html_url
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }
}
