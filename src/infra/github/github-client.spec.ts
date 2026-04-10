import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalApiError, NotFoundError } from "../../domain/errors";
import { GithubClient } from "./github-client";

function mockFetch(status: number, headers: Record<string, string> = {}, body: unknown = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (key: string) => headers[key] ?? null },
      json: () => Promise.resolve(body)
    })
  );
}

describe("GithubClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("assertRepositoryExists", () => {
    it("resolves when repo exists (200)", async () => {
      mockFetch(200, {}, { full_name: "foo/bar" });
      const client = new GithubClient();
      await expect(client.assertRepositoryExists("foo", "bar")).resolves.toBeUndefined();
    });

    it("throws NotFoundError on 404", async () => {
      mockFetch(404);
      const client = new GithubClient();
      await expect(client.assertRepositoryExists("foo", "bar")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("rate limiting", () => {
    it("throws GITHUB_RATE_LIMIT on 429 and reads retry-after header", async () => {
      mockFetch(429, { "retry-after": "30" });
      const client = new GithubClient();

      const error = await client.assertRepositoryExists("foo", "bar").catch((e) => e);

      expect(error).toBeInstanceOf(ExternalApiError);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("GITHUB_RATE_LIMIT");
      expect(error.retryAfterSeconds).toBe(30);
    });

    it("throws GITHUB_RATE_LIMIT on 403 when x-ratelimit-remaining is 0", async () => {
      const resetAt = Math.floor(Date.now() / 1000) + 120;
      mockFetch(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(resetAt) });
      const client = new GithubClient();

      const error = await client.assertRepositoryExists("foo", "bar").catch((e) => e);

      expect(error).toBeInstanceOf(ExternalApiError);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("GITHUB_RATE_LIMIT");
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("throws GITHUB_FORBIDDEN on 403 when x-ratelimit-remaining is not 0 (auth error)", async () => {
      mockFetch(403, { "x-ratelimit-remaining": "59" });
      const client = new GithubClient();

      const error = await client.assertRepositoryExists("foo", "bar").catch((e) => e);

      expect(error).toBeInstanceOf(ExternalApiError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("GITHUB_FORBIDDEN");
    });

    it("throws GITHUB_FORBIDDEN on 403 when x-ratelimit-remaining header is absent", async () => {
      mockFetch(403, {});
      const client = new GithubClient();

      const error = await client.assertRepositoryExists("foo", "bar").catch((e) => e);

      expect(error).toBeInstanceOf(ExternalApiError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("GITHUB_FORBIDDEN");
    });
  });

  describe("getLatestRelease", () => {
    it("returns release info on 200", async () => {
      mockFetch(200, {}, { tag_name: "v1.2.3", published_at: "2025-01-01T00:00:00Z", html_url: "https://example.com" });
      const client = new GithubClient();
      const release = await client.getLatestRelease("foo", "bar");

      expect(release).toEqual({
        tagName: "v1.2.3",
        publishedAt: "2025-01-01T00:00:00Z",
        htmlUrl: "https://example.com"
      });
    });

    it("returns null when repo has no releases (404)", async () => {
      mockFetch(404);
      const client = new GithubClient();
      const release = await client.getLatestRelease("foo", "bar");

      expect(release).toBeNull();
    });

    it("propagates rate limit error instead of returning null", async () => {
      mockFetch(429, { "retry-after": "60" });
      const client = new GithubClient();

      await expect(client.getLatestRelease("foo", "bar")).rejects.toBeInstanceOf(ExternalApiError);
    });
  });
});
