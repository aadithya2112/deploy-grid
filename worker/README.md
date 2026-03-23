# Worker

This service consumes deployment jobs from Upstash Redis, builds React apps in
isolated temporary directories, uploads build artifacts to Cloudflare R2, and
updates `deployments`, `build_jobs`, and `deployment_logs` in Postgres.

## Setup

1. Copy `.env.example` to `.env`.
2. Point the worker at the same `DATABASE_URL`,
   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
   `PROJECT_ENV_ENCRYPTION_KEY` used by the API.
3. Configure Cloudflare R2 credentials and either `ARTIFACT_BASE_URL` or
   `R2_PUBLIC_BASE_URL`.

## Scripts

```bash
bun install
bun run typecheck
bun run test
bun run start
bun run smoke
```

## Behavior

- Queue payloads follow `../api/src/contracts/deployment-job.ts`.
- Postgres is treated as the source of truth before any expensive work starts.
- Build jobs are claimed with a lease and refreshed while the build is running.
- Transient install/build command failures are retried a small bounded number of times.
- A recovery loop re-enqueues stale queued jobs and expired running jobs.
- Deployment logs are streamed into `deployment_logs` with ordered sequences.

## Smoke Test

Use the smoke script to create a deployment through the API and stream logs until
it finishes:

```bash
API_BASE_URL=http://localhost:3000 \
SMOKE_PROJECT_ID=<project-id> \
bun run smoke
```

Or create a deployment from a repository URL:

```bash
API_BASE_URL=http://localhost:3000 \
SMOKE_REPO_URL=https://github.com/owner/repo.git \
SMOKE_GIT_REF=main \
bun run smoke
```
