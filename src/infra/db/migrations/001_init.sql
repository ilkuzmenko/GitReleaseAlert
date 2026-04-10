CREATE TABLE IF NOT EXISTS repositories (
  id BIGSERIAL PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  last_seen_tag TEXT NULL,
  last_release_published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  repository_id BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, repository_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_repository_id ON subscriptions(repository_id);
CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
