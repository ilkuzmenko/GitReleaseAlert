# GitReleaseAlert

Monolithic Node.js + Express + PostgreSQL service for email notifications about new GitHub releases.

## Features

- REST API for subscription management (create, list, deactivate).
- OpenAPI contract in `openapi.yaml` with Swagger UI at `/docs`.
- Repository existence validation via GitHub API on subscription creation.
- Background release scanner running in the same process — no microservices.
- `last_seen_tag` persisted per repository to avoid duplicate notifications.
- Email delivery via SMTP (Mailpit included in `docker-compose.yml` for local testing).
- Auto-applied SQL migrations on every service startup.
- GitHub API rate limit handling with automatic backoff.
- Optional API key authentication via `X-API-Key` header.

## Architecture & Design Decisions

### Layer structure

```
src/
├── domain/        # Business logic: models, errors, SubscriptionService
├── infra/         # I/O adapters: GitHub client, DB repositories, SMTP notifier
├── api/           # HTTP layer: Express routes, error middleware
├── jobs/          # Background work: ReleaseScanner
├── app.ts         # Express app factory (testable, no side effects)
└── server.ts      # Composition root: wires dependencies and starts the process
```

`domain/` has zero knowledge of Express or PostgreSQL — all external dependencies are injected through constructors. This keeps business logic pure and unit-testable without a database or HTTP stack.

### Subscription flow

1. `POST /subscriptions` validates input with Zod (`email` format + `owner/repo` regex).
2. GitHub API is called to confirm the repository exists before persisting anything.
3. `repositories` and `subscriptions` rows are upserted — re-subscribing the same email to the same repo reactivates the existing record instead of creating a duplicate.

### Scanner

`ReleaseScanner.runOnce()` fetches all repositories that have at least one active subscription, then calls `GET /repos/:owner/:repo/releases/latest` for each. If `tag_name` differs from the stored `last_seen_tag`, it updates the record and fans out emails to all active subscribers for that repository.

The scanner runs immediately on startup (one eager scan before the first interval fires) and then on a configurable `SCAN_INTERVAL_MS` cycle via `setInterval`.

### Rate limit handling

GitHub returns `429` (and occasionally `403` with `x-ratelimit-remaining: 0`) when the rate limit is exhausted. The client distinguishes these from a genuine `403 Forbidden` (e.g. bad token) by inspecting the `x-ratelimit-remaining` header:

- `429` or `403` + `remaining == 0` → `GITHUB_RATE_LIMIT` error with backoff derived from `retry-after` or `x-ratelimit-reset`.
- `403` + `remaining != 0` → `GITHUB_FORBIDDEN` error, logged and skipped — no backoff.

`ReleaseScanner` stores `nextAllowedRunAt` and skips entire scan cycles until the backoff window expires.

### Error handling

A custom `AppError` hierarchy (`ValidationError`, `NotFoundError`, `ExternalApiError`) carries `statusCode` and `code`. The Express error middleware converts these directly to structured JSON responses matching the OpenAPI contract:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Unrecognised errors are caught and returned as `500 INTERNAL_SERVER_ERROR` without leaking stack traces.

### Migrations

A minimal migration runner tracks applied files in a `schema_migrations` table. Each migration runs inside a transaction — on failure it rolls back and the process exits. On startup the runner retries up to 20 times with a 1.5 s delay to tolerate the Docker postgres container not being ready yet.

## API Contract

Full contract is in `openapi.yaml`. Preview it at [Swagger Editor](https://editor.swagger.io/) or at `/docs` when the service is running.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/subscriptions` | Subscribe an email to a repository's releases |
| `GET` | `/subscriptions` | List active subscriptions |
| `DELETE` | `/subscriptions/{id}` | Deactivate a subscription |
| `GET` | `/health` | Health check |

## Environment Variables

Copy and adjust:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/release_alert` | PostgreSQL connection string |
| `GITHUB_TOKEN` | _(empty)_ | Personal access token — optional but raises rate limit from 60 to 5 000 req/hr |
| `SCAN_INTERVAL_MS` | `60000` | How often the scanner polls GitHub (ms) |
| `SMTP_HOST` | `localhost` | SMTP host |
| `SMTP_PORT` | `1025` | SMTP port |
| `SMTP_USER` | _(empty)_ | SMTP username |
| `SMTP_PASS` | _(empty)_ | SMTP password |
| `SMTP_FROM` | `alerts@example.com` | Sender address |
| `API_KEY` | _(empty)_ | API key for `X-API-Key` header authentication. If empty — auth is disabled |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string for GitHub API response caching (TTL 10 min) |

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Services:

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- Mailpit UI (inspect sent emails): `http://localhost:8025`

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

PostgreSQL must be available and `DATABASE_URL` must point to it.

## Example flow

```bash
# 1. Subscribe (add -H "X-API-Key: <key>" if API_KEY is set)
curl -X POST http://localhost:3000/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","repository":"renovatebot/renovate"}'

# 2. List active subscriptions
curl http://localhost:3000/subscriptions

# 3. Deactivate
curl -X DELETE http://localhost:3000/subscriptions/1
```

On the next scanner cycle (or immediately at startup), if a new release tag is detected the email is sent. Open Mailpit at `http://localhost:8025` to inspect it.

## Tests

```bash
npm test
```

Unit tests (23 total) cover:

- `SubscriptionService`: happy path, invalid `owner/repo` format (400), GitHub repo not found (404), subscription list delegation.
- `ReleaseScanner`: notification on new tag, skip when tag unchanged, global backoff on 429.
- `GithubClient`: successful responses, 404, 429 with `retry-after`, 403 as rate limit (`x-ratelimit-remaining: 0`), 403 as auth error (`GITHUB_FORBIDDEN`), `getLatestRelease` returning null on 404 and propagating rate limit errors.
- `ApiKeyMiddleware`: auth disabled when key not configured, correct key passes, wrong key returns 401, missing header returns 401.
