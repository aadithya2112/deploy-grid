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
- Added project-centric endpoints:
  - `POST /projects`
  - `GET /projects`
  - `GET /projects/:id`
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

- project and deployment list endpoints currently use offset-based pagination only
- env vars are masked on read, but secret encryption/rotation policy is still pending
- auth and request validation can be tightened further
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

- project update endpoints for editing build settings after creation
- redeploy support
- stronger pagination and filtering for list endpoints
- optional internal endpoints if the worker should update state through HTTP instead of SQL

### Secrets and metadata hardening

- encrypt project env var values at rest
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
- request-level validation cleanup
- auth and access control

## Recommended next steps

1. Implement the external worker repo against the current queue payload and Postgres contract.
2. Add project update and redeploy endpoints in the API.
3. Encrypt project env var values and define secret-management rules.
4. Add auth and stricter request validation to the expanded API surface.

## Notes

- The current `POST /deployments` endpoint is still useful as a transitional API, even if the longer-term model becomes project-centric.
- Postgres is the source of truth.
- Upstash Redis is used for dispatch, not as the canonical state store.
- The worker runtime is intentionally treated as external to this repository.
