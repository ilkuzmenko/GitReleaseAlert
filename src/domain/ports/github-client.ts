import { ReleaseInfo } from "../models";

export interface GithubClientPort {
  assertRepositoryExists(owner: string, repo: string): Promise<void>;
  getLatestRelease(owner: string, repo: string): Promise<ReleaseInfo | null>;
}
