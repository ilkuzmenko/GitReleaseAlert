import { describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../errors";
import { SubscriptionService } from "./subscription-service";

describe("SubscriptionService", () => {
  it("creates subscription when repo exists", async () => {
    const repositoriesRepository = {
      upsert: vi.fn().mockResolvedValue({ id: 1, fullName: "renovatebot/renovate" })
    };
    const subscriptionsRepository = {
      createOrActivate: vi.fn().mockResolvedValue({
        id: 10,
        email: "test@example.com",
        isActive: true,
        createdAt: new Date("2025-01-01T00:00:00.000Z")
      })
    };
    const githubClient = {
      assertRepositoryExists: vi.fn().mockResolvedValue(undefined)
    };

    const service = new SubscriptionService(
      repositoriesRepository as any,
      subscriptionsRepository as any,
      githubClient as any
    );
    const result = await service.createSubscription({
      email: "test@example.com",
      repository: "renovatebot/renovate"
    });

    expect(githubClient.assertRepositoryExists).toHaveBeenCalledWith("renovatebot", "renovate");
    expect(result.repository).toBe("renovatebot/renovate");
  });

  it("throws 400 for invalid owner/repo format", async () => {
    const service = new SubscriptionService({} as any, {} as any, {} as any);

    await expect(
      service.createSubscription({
        email: "test@example.com",
        repository: "bad-format"
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns only active subscriptions from repository", async () => {
    const activeSubscription = {
      id: 1,
      email: "user@example.com",
      repository: "renovatebot/renovate",
      isActive: true,
      createdAt: "2025-01-01T00:00:00.000Z"
    };
    const subscriptionsRepository = {
      listAll: vi.fn().mockResolvedValue([activeSubscription])
    };

    const service = new SubscriptionService({} as any, subscriptionsRepository as any, {} as any);
    const result = await service.listSubscriptions();

    expect(result).toEqual([activeSubscription]);
    expect(subscriptionsRepository.listAll).toHaveBeenCalledTimes(1);
  });

  it("throws 404 when GitHub repo does not exist", async () => {
    const service = new SubscriptionService(
      {} as any,
      {} as any,
      {
        assertRepositoryExists: vi.fn().mockRejectedValue(new NotFoundError("missing"))
      } as any
    );

    await expect(
      service.createSubscription({
        email: "test@example.com",
        repository: "foo/bar"
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
