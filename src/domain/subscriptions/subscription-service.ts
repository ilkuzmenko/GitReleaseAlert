import { z } from "zod";
import { NotFoundError, ValidationError } from "../errors";
import { SubscriptionView } from "../models";
import { RepositoriesRepository } from "../../infra/db/repositories-repository";
import { SubscriptionsRepository } from "../../infra/db/subscriptions-repository";
import { GithubClient } from "../../infra/github/github-client";

const createSubscriptionSchema = z.object({
  email: z.email(),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "repository must have owner/repo format")
});

export class SubscriptionService {
  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly githubClient: GithubClient
  ) {}

  async createSubscription(input: { email: string; repository: string }): Promise<SubscriptionView> {
    const parsed = createSubscriptionSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request payload");
    }

    const [owner, repo] = parsed.data.repository.split("/");

    try {
      await this.githubClient.assertRepositoryExists(owner, repo);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError("Repository not found on GitHub");
      }
      throw error;
    }

    const repositoryRecord = await this.repositoriesRepository.upsert(owner, repo);
    const subscription = await this.subscriptionsRepository.createOrActivate(parsed.data.email, repositoryRecord.id);

    return {
      id: subscription.id,
      email: subscription.email,
      repository: repositoryRecord.fullName,
      isActive: subscription.isActive,
      createdAt: subscription.createdAt.toISOString()
    };
  }

  async listSubscriptions(): Promise<SubscriptionView[]> {
    return this.subscriptionsRepository.listAll();
  }

  async deactivateSubscription(id: number): Promise<void> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError("subscription id must be a positive integer");
    }
    const deactivated = await this.subscriptionsRepository.deactivate(id);
    if (!deactivated) {
      throw new NotFoundError("Active subscription not found");
    }
  }
}
