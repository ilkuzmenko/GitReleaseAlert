export type RepositoryRecord = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  lastSeenTag: string | null;
  lastReleasePublishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionRecord = {
  id: number;
  email: string;
  repositoryId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionView = {
  id: number;
  email: string;
  repository: string;
  isActive: boolean;
  createdAt: string;
};

export type ReleaseInfo = {
  tagName: string;
  publishedAt: string | null;
  htmlUrl: string;
};
