# Worker Requirements

This document defines the requirements for the external worker that builds React deployments for this project.

The worker should treat this `api` repo as the source of truth for:

- queue payload shape
- Postgres schema
- deployment and build-job lifecycle
- secret encryption format

## Purpose

The worker is responsible for turning a queued deployment request into a built artifact and updating durable state in Postgres.

The worker is not an API server. It should run as a separate long-lived process or service, consume queued jobs, execute builds in isolation, upload artifacts, and write progress back to the database.

## Current API Contract

The API currently does the following before the worker starts:

1. Creates a `deployments` row with status `queued`
2. Creates a `build_jobs` row with status `queued`
3. Pushes a queue message into Upstash Redis

The worker is expected to take over from there.

Relevant code in this repo:

- Queue payload: `src/contracts/deployment-job.ts`
- Queue producer: `src/queues/deployment.queue.ts`
- Schema: `src/db/schema.ts`
- Deployment creation flow: `src/services/deployment.service.ts`
- Env encryption format: `src/infrastructure/project-env-crypto.ts`

## Scope

The worker must:

- consume deployment jobs from Upstash Redis
- load the referenced deployment, build job, project, and project env vars from Postgres
- claim a build job safely
- clone the repository at the requested git ref
- install dependencies
- build the React app
- determine the output directory
- upload the built files to artifact storage
- update deployment/build-job state in Postgres
- stream logs into `deployment_logs`
- handle retries and crash recovery safely

The worker must not:

- create deployments on its own
- mutate project settings
- rely on API list endpoints for internal state
- read masked env var values from API responses and expect them to be usable secrets

## Recommended Implementation Stack

Use Bun for the worker runtime unless there is a strong reason not to. This keeps parity with the API and existing project conventions.

Recommended components:

- Bun runtime
- Drizzle ORM or direct SQL for Postgres access
- Upstash Redis client for queue consumption
- isolated working directory per deployment
- Cloudflare R2 via its S3-compatible API for artifact upload

## Required Environment Variables

The worker will need at least:

- `DATABASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `DEPLOYMENT_QUEUE_NAME` if not using the default `deployment_jobs`
- `PROJECT_ENV_ENCRYPTION_KEY`
- artifact storage credentials for Cloudflare R2
- a unique worker identity such as `WORKER_ID`
- a base temporary directory such as `WORKER_TMP_DIR`

Suggested additional settings:

- `BUILD_JOB_LEASE_SECONDS`
- `HEARTBEAT_INTERVAL_SECONDS`
- `MAX_BUILD_ATTEMPTS`
- `ARTIFACT_BASE_URL`

Current expected artifact-storage env vars:

- `ARTIFACT_BASE_URL`: base URL the deployment should ultimately be served from
- `ARTIFACT_BUCKET`: current R2 bucket name
- `ARTIFACT_ACCESS_KEY`: R2 S3 access key ID
- `ARTIFACT_SECRET_KEY`: R2 S3 secret access key
- `R2_S3_ENDPOINT`: jurisdiction-specific Cloudflare R2 S3 endpoint
- `R2_PUBLIC_BASE_URL`: public bucket URL used for development if no custom domain exists yet

Optional env var:

- `R2_API_TOKEN`: useful for future Cloudflare API calls, but not required for basic S3-compatible uploads

## Current Artifact Storage Decision

The current worker plan uses Cloudflare R2 as the artifact store.

Current assumptions:

- bucket name: `deploy-grid`
- uploads happen through the S3-compatible R2 endpoint
- development access can use the bucket's public `r2.dev` URL
- production should eventually use a custom domain instead of relying on the public development URL

Artifact ownership split:

- Postgres stores metadata such as `artifact_url`
- Redis only dispatches jobs
- R2 stores the actual built React files

## Queue Message Contract

The API enqueues this payload:

```ts
interface DeploymentJobMessage {
  buildJobId: string
  deploymentId: string
  projectId: string
  repoUrl: string
  gitRef: string
  rootDirectory: string | null
  installCommand: string | null
  buildCommand: string | null
  outputDirectory: string | null
}
```

Interpretation:

- `buildJobId`: the row to claim and update
- `deploymentId`: the deployment whose lifecycle the worker advances
- `projectId`: the owning project
- `repoUrl`: git source to clone
- `gitRef`: branch, tag, or commit-ish requested by the API
- `rootDirectory`: optional subdirectory within the repo where the app lives
- `installCommand`: optional project override
- `buildCommand`: optional project override
- `outputDirectory`: optional project override

The queue payload should be treated as a hint, not the canonical source of truth. Before building, the worker must load the latest database state and validate that the referenced rows still exist and are still actionable.

## Postgres Tables The Worker Must Use

### `projects`

Used to confirm build settings:

- `repo_url`
- `default_branch`
- `root_directory`
- `install_command`
- `build_command`
- `output_directory`

### `deployments`

The worker is responsible for updating at least:

- `status`
- `commit_sha`
- `error_message`
- `artifact_url`
- `build_started_at`
- `build_finished_at`
- `updated_at`

The API may already set `preview_url`. The worker should preserve it unless there is a clear reason to update it.

### `build_jobs`

The worker is responsible for updating at least:

- `status`
- `claimed_by`
- `lease_until`
- `attempts`
- `last_error`
- `updated_at`

### `deployment_logs`

The worker must append structured log lines with:

- `deployment_id`
- `stream` as `stdout`, `stderr`, or `system`
- `sequence`
- `message`

### `project_env_vars`

The worker must read env vars directly from Postgres and decrypt them using the same algorithm defined in `src/infrastructure/project-env-crypto.ts`.

The API only exposes masked values over HTTP. The worker must not use those masked values for builds.

## Required State Machine

### Deployment state transitions

Expected deployment transitions:

- `queued` -> `building`
- `building` -> `ready`
- `building` -> `failed`

`cancelled` exists in the schema but there is no full cancellation flow yet. The worker should treat `cancelled` as non-actionable and stop work if it sees that state before starting a build.

### Build-job state transitions

Expected build-job transitions:

- `queued` -> `running`
- `running` -> `succeeded`
- `running` -> `failed`

## Job Consumption Requirements

The worker must consume jobs in a way that is as crash-safe as possible.

Minimum requirement:

1. Read a job from the queue
2. Fetch the referenced `build_jobs` row
3. If the build job is already `running`, `succeeded`, or `failed`, do not execute the build again
4. Attempt to claim the job in Postgres before doing any expensive work

Recommended requirement:

- Use a reliable queue-consumption pattern instead of a simple destructive pop if supported by the Redis client
- Maintain a recovery path for jobs lost after pop but before completion

Because Postgres is the source of truth, the worker must be idempotent even if the same queue message is delivered multiple times.

## Claiming And Lease Rules

Before cloning or building, the worker must claim the build job.

Claiming should:

- set `build_jobs.status` to `running`
- set `build_jobs.claimed_by` to the current worker identity
- set `build_jobs.lease_until` to now plus a short lease window
- increment `build_jobs.attempts`

Once a job is claimed, the worker should:

- update `deployments.status` to `building`
- set `deployments.build_started_at` if not already set
- clear any prior deployment `error_message`
- write a `system` log entry saying the build started

While the build is running, the worker must periodically extend the lease.

If the worker crashes and the lease expires, another worker or a recovery process may reclaim the job.

## Idempotency Rules

The worker must be safe under duplicate delivery.

For a given `buildJobId` and `deploymentId`:

- if the build job is already `succeeded`, do nothing
- if the build job is already `failed` and retry policy says stop, do nothing
- if the deployment is already `ready`, do nothing
- if another healthy worker owns the lease, do not steal the job
- if the lease is expired, the job may be reclaimed

The worker should always re-read current DB state before marking final success or failure.

## Repository Checkout Requirements

The worker must:

1. Create an isolated temp directory per deployment
2. Clone `repoUrl`
3. Check out `gitRef`
4. Resolve and store the exact commit SHA in `deployments.commit_sha`
5. If `rootDirectory` is present, change into that directory before install/build

Validation rules:

- fail fast if the repo cannot be cloned
- fail fast if `gitRef` does not exist
- fail fast if `rootDirectory` is set but missing

The worker must never reuse the same working directory for multiple active deployments.

## Build Command Resolution

Command precedence should be:

1. project-level override from the queue payload or latest `projects` row
2. framework defaults when override is absent

Recommended defaults for the current React-only scope:

- install: `bun install`, `npm install`, or equivalent based on lockfile detection
- build: framework-specific production build command
- output directory:
  - explicit `outputDirectory` if configured
  - otherwise detect common React outputs such as `dist` or `build`

Suggested lockfile detection order:

- `bun.lock` or `bun.lockb` -> Bun
- `pnpm-lock.yaml` -> pnpm
- `yarn.lock` -> yarn
- `package-lock.json` -> npm
- otherwise default to Bun or npm, but log the fallback explicitly

The worker must log which install tool and build command were chosen.

## Environment Variable Resolution

The worker must assemble the build environment from `project_env_vars`.

Resolution rules:

- include all vars with target `all`
- include vars with target matching the deployment environment
- more specific target overrides `all` when keys collide

For the current React-only preview flow:

- deployments created by this API should be treated as `preview` builds unless a future production flow is added

The worker must:

- decrypt env var values using the exact AES-GCM format already used by the API
- inject them into the build process environment
- never write plaintext secrets to logs
- never upload plaintext secrets in artifacts

If `PROJECT_ENV_ENCRYPTION_KEY` is missing or decryption fails, the worker must fail the deployment with a clear non-secret error.

## Logging Requirements

The worker must stream logs to `deployment_logs` during execution.

Rules:

- use `stdout` for normal command output
- use `stderr` for command errors
- use `system` for worker lifecycle events
- maintain a monotonically increasing `sequence` per deployment
- keep messages append-only

Minimum lifecycle log entries:

- job claimed
- clone started
- clone completed
- dependencies install started
- dependencies install completed
- build started
- build completed
- artifact upload started
- artifact upload completed
- deployment marked ready or failed

The worker should chunk or truncate excessively large lines if necessary, but it must preserve useful error context.

## Artifact Requirements

After a successful build, the worker must:

1. locate the final output directory
2. verify it exists and contains deployable static files
3. upload its contents to Cloudflare R2
4. compute the final public or internal artifact URL
5. persist that URL to `deployments.artifact_url`

The worker should not mark the deployment `ready` until artifact upload succeeds.

If upload fails after a successful local build, the deployment must still be marked `failed` because it is not actually deployable.

### Cloudflare R2 artifact layout

Recommended object key layout:

- `deployments/<deploymentId>/index.html`
- `deployments/<deploymentId>/assets/...`

The worker should upload the full build output directory under a deployment-scoped prefix so every deployment is immutable and independently addressable.

### Artifact URL policy

For the current setup:

- if a custom serving domain exists, prefer that as `ARTIFACT_BASE_URL`
- otherwise use `R2_PUBLIC_BASE_URL` for development

Recommended stored URL:

- `https://<artifact-base>/deployments/<deploymentId>/`

The worker should treat the public `r2.dev` URL as development-only because it is rate-limited and not ideal for production traffic.

## Success Path

On success, the worker must:

1. mark `build_jobs.status` as `succeeded`
2. clear `build_jobs.last_error`
3. mark `deployments.status` as `ready`
4. set `deployments.build_finished_at`
5. clear `deployments.error_message`
6. persist `deployments.commit_sha`
7. persist `deployments.artifact_url`
8. write final success log entries
9. clean up the temp working directory

## Failure Path

On any failure after claim, the worker must:

1. capture a non-secret error summary
2. append failure logs
3. set `build_jobs.status` to `failed`
4. set `build_jobs.last_error`
5. set `deployments.status` to `failed`
6. set `deployments.error_message`
7. set `deployments.build_finished_at`
8. release or allow expiry of the lease
9. clean up the temp working directory if possible

Failures must be visible in both:

- `build_jobs.last_error`
- `deployments.error_message`

## Retry And Recovery Requirements

The worker implementation should include retry behavior, but retries must be bounded.

Required behavior:

- failed commands inside a single build may retry a small number of times only when the error is clearly transient
- full deployment retries should be controlled by `build_jobs.attempts`
- once `MAX_BUILD_ATTEMPTS` is reached, the worker must stop retrying

Recommended recovery behavior:

- periodically scan for `build_jobs` stuck in `running` with expired `lease_until`
- determine whether they should be retried or permanently failed
- optionally re-enqueue recoverable jobs

The recovery process can run in the same worker service or as a separate maintenance loop.

## Security Requirements

The worker must:

- run untrusted builds in isolated directories
- avoid sharing writable state between deployments
- never log secrets
- never expose raw env var values outside the child process environment
- validate `rootDirectory` so it cannot escape the repo checkout
- sanitize artifact paths before upload

Strongly recommended:

- run builds with CPU and memory limits
- run builds with a timeout
- consider container or sandbox isolation for untrusted repos

## Observability Requirements

The worker should emit structured internal logs and metrics for:

- queue consumption latency
- clone duration
- install duration
- build duration
- upload duration
- success rate
- failure rate by stage
- lease refresh failures
- retry count

At minimum, the worker should make it easy to answer:

- which worker claimed a job
- what stage a failed deployment reached
- whether a job is still actively progressing

## Acceptance Criteria

The worker is acceptable when all of the following are true:

1. A deployment created by `POST /deployments` or `POST /projects/:id/deployments` is eventually consumed by the worker.
2. The worker marks the build job `running`, then `succeeded` or `failed`.
3. The worker marks the deployment `building`, then `ready` or `failed`.
4. The worker writes ordered deployment logs throughout execution.
5. The worker persists the resolved commit SHA.
6. The worker uploads build output and writes `artifact_url` on success.
7. The worker decrypts project env vars correctly using `PROJECT_ENV_ENCRYPTION_KEY`.
8. Duplicate queue messages do not cause duplicate successful builds for the same build job.
9. Crashed workers do not leave jobs permanently stuck without a recovery path.
10. Temporary build directories are cleaned up after completion.

## Suggested Implementation Order

1. Read from the queue and parse `DeploymentJobMessage`.
2. Load `build_jobs`, `deployments`, `projects`, and `project_env_vars`.
3. Implement job claim plus lease heartbeat.
4. Implement checkout plus commit SHA persistence.
5. Implement install/build execution with log streaming.
6. Implement env var decryption and injection.
7. Implement artifact detection and upload.
8. Implement success/failure state updates.
9. Implement recovery for expired leases.
10. Add tests for duplicate delivery, build failure, upload failure, and worker crash recovery.

## Important Notes For The Worker Repo

- Postgres is the source of truth.
- Upstash Redis is only the dispatch layer.
- The queue payload may become stale; always prefer the latest DB state before acting.
- API responses for env vars are intentionally masked; the worker must use the database.
- The worker should preserve compatibility with the schema and crypto implementation in this repo.
