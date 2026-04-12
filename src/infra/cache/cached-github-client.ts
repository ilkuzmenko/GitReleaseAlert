import { createClient } from "redis";
import { ReleaseInfo } from "../../domain/models";
import { GithubClientPort } from "../../domain/ports/github-client";

export class CachedGithubClient implements GithubClientPort {
  constructor(
    private readonly github: GithubClientPort,
    private readonly redis: ReturnType<typeof createClient>,
    private readonly ttlSeconds = 600
  ) {}

  assertRepositoryExists(owner: string, repo: string): Promise<void> {
    return this.github.assertRepositoryExists(owner, repo);
  }

  async getLatestRelease(owner: string, repo: string): Promise<ReleaseInfo | null> {
    const key = `github:release:${owner}/${repo}`;
    const cached = await this.redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as ReleaseInfo | null;
    }

    const release = await this.github.getLatestRelease(owner, repo);
    await this.redis.set(key, JSON.stringify(release), { EX: this.ttlSeconds });
    return release;
  }
}
