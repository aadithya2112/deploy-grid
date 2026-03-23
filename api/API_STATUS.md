# API Status

This file tracks what is complete and what is still pending for the `api` app of the React-only Vercel clone.

## Current focus

The API now owns:
- Neon Postgres schema and migrations
- durable deployment persistence
- Upstash Redis queue dispatch
- project, deployment, log, and env var HTTP endpoints
- the worker-facing database contract and queue payload shape

The worker runtime is expected to live in a separate repository and VM. This repo does not own clone/build/upload execution anymore; it owns the queue producer, schema, HTTP API, and worker-facing persistence contract.

## Done

### Phase 1: Database foundation

- Added Drizzle ORM and `drizzle-kit`
- Added Neon Postgres connection setup
- Added shared environment loading for `DATABASE_URL`
- Added initial schema for:
  - `projects`
  - `deployments`
  - `build_jobs`
  - `deployment_logs`
- Generated and applied migrations to Neon

### Phase 2: Persistent deployment flow

- Replaced the in-memory deployment repository with Postgres-backed persistence
- Added `ProjectRepository`
- Added `BuildJobRepository`
- Extended the deployment domain model to include:
  - `projectId`
  - `gitRef`
  - `commitSha`
  - `previewUrl`
  - `artifactUrl`
  - build timestamps
- Updated `POST /deployments` to:
  - find or create a project from `repoUrl`
  - create a deployment row
  - create a build job row
  - enqueue a worker job in Upstash Redis
- Updated `GET /deployments/:id` to read from Postgres

### Queue integration

- Added Upstash Redis client integration
- Added a deployment job contract for worker payloads
- Queue name defaults to `deployment_jobs`

### Testing foundation

- Added Bun test scripts:
  - `bun run test`
  - `bun run test:integration`
- Added shared test preload setup in `test/setup.ts`
- Added unit tests for:
  - deployment domain logic
  - project metadata derivation
  - deployment controller validation
  - deployment route dispatch
  - deployment service orchestration
- Added integration tests for:
  - `ProjectRepository`
  - `DeploymentRepository`
  - `BuildJobRepository`
- Verified the suite with:
  - `bun run typecheck`
  - `bun run test`

### Core API surface

- Added `GET /health` with a database-backed health check
- Added `GET /deployments/:id/logs`
- Added `POST /deployments/:id/redeploy`
- Added project-centric endpoints:
  - `POST /projects`
  - `GET /projects`
  - `GET /projects/:id`
  - `PATCH /projects/:id`
  - `POST /projects/:id/deployments`
  - `GET /projects/:id/deployments`
- Kept the transitional `POST /deployments` endpoint
- Added project env var endpoints:
  - `GET /projects/:id/env-vars`
  - `PUT /projects/:id/env-vars/:key`
  - `DELETE /projects/:id/env-vars/:key?target=...`

### API-owned repository contract

- Added `DeploymentLogRepository`
- Added `ProjectEnvVarRepository`
- Extended `ProjectRepository` with:
  - create
  - find by id
  - list
  - update settings
- Extended `DeploymentRepository` with:
  - list by project
  - latest by project
- Extended `BuildJobRepository` with:
  - find by id
  - find by deployment id
  - mark running
  - refresh lease
  - mark succeeded
  - mark failed

### Deployment metadata and CI

- Added API-side preview URL policy through `DEPLOYMENT_PREVIEW_BASE_URL`
- Added `PORT` handling to shared env config
- Added queue smoke coverage for enqueue behavior
- Added CI workflow to run:
  - migrations
  - `bun run typecheck`
  - `bun run test`

### API hardening and control-plane polish

- Added optional Bearer-token auth through `API_AUTH_TOKEN`
- Added shared request parsing and validation helpers
- Added encrypted project env var storage through `PROJECT_ENV_ENCRYPTION_KEY`
- Added masked env var reads after decryption
- Added pagination metadata and basic filtering for list endpoints
- Added tests for:
  - auth helper behavior
  - project update flow
  - redeploy flow
  - encrypted env var handling
  - filtered/paginated project and deployment listing

## In progress

### External worker integration

- API is no longer the component that should run clone/build/serve directly
- Queueing is in place
- The worker runtime lives outside this repo
- The external worker still needs to:
  - consume jobs from Upstash Redis
  - load project and deployment data from Postgres
  - run clone, install, and build steps
  - detect build output and produce artifact metadata
  - update `deployments`, `build_jobs`, and `deployment_logs`
  - upload artifacts and persist final `artifactUrl`

### API hardening and follow-up polish

- project and deployment list endpoints still use offset-based pagination rather than cursor pagination
- env vars are encrypted and masked, but rotation conventions are still pending
- auth currently uses a single shared API token and can be expanded to real user/project access control
- health checks can be expanded to include queue-level visibility if needed

## Not done yet

### External worker repository

- Consume queued jobs from Upstash Redis
- Load deployment and project data
- Clone the repo
- Install dependencies
- Build the React app
- Detect output directory
- Upload artifacts
- Update deployment status and build job status
- Write deployment logs

### Remaining API enhancements

- richer filtering and cursor-style pagination for list endpoints
- optional internal endpoints if the worker should update state through HTTP instead of SQL
- richer deployment detail shaping if the UI needs more status context
- project update history or audit metadata if config changes need traceability

### Secrets and metadata hardening

- define env var rotation/update conventions
- artifact URL persistence from the external worker
- richer preview metadata once the worker starts publishing artifacts

### Testing

- Worker integration tests
- API-level integration tests for future project endpoints
- end-to-end tests against an external worker staging environment

### Operational hardening

- worker retry strategy
- dead-letter handling or failed job recovery
- queue-aware health and readiness checks
- auth and access control beyond a shared API token
- request-level validation cleanup for any future endpoints

## Recommended next steps

1. Implement the external worker repo against the current queue payload and Postgres contract.
2. Define env var rotation/update conventions and worker-side secret consumption rules.
3. Add richer pagination/filtering and deployment detail shaping for the dashboard.
4. Replace or extend the shared API token with stronger access control if multi-user access is needed.

## Notes

- The current `POST /deployments` endpoint is still useful as a transitional API, even if the longer-term model becomes project-centric.
- Postgres is the source of truth.
- Upstash Redis is used for dispatch, not as the canonical state store.
- The worker runtime is intentionally treated as external to this repository.
