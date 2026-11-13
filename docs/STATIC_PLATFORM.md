# Deploy Grid static platform

Deploy Grid builds React/Vite, Vue/Vite, Astro static sites, and Next.js static
exports. SSR, Server Actions, runtime API routes, arbitrary backend servers,
customer databases, and custom customer domains are outside this release.
Next.js needs `output: "export"`; use `images.unoptimized` or a compatible image loader.
Configuration is inspected as text, never imported by the privileged supervisor.
Computed Next configuration that does not contain a literal export declaration is
rejected with an actionable error. Every deployment must produce `index.html`.

## Architecture

```mermaid
flowchart LR
  Web[Next.js dashboard + Clerk] --> API[Cloudflare API Worker]
  GitHub[GitHub App webhooks] --> API
  API --> DB[(Neon PostgreSQL)]
  API --> Queue[(Upstash queue)]
  API --> Actions[GitHub Actions runner]
  Actions --> Supervisor[Credentialed supervisor]
  Supervisor --> Sandbox[Restricted Docker build]
  Supervisor --> R2[(Private R2 artifacts)]
  Visitor --> Edge[Cloudflare site router]
  Edge --> API
  Edge --> R2
```

The existing dashboard remains on its existing host. Upstash is retained rather
than migrating the queue at the same time. The default hosted builder is an
**ephemeral GitHub Actions runner**, not the old Cloud Run service. Cloud Run
cannot execute this Docker backend. Do not deploy the new builder on Cloud Run.
There is no unsandboxed production fallback.

Each successful attempt has a unique R2 prefix. The router resolves only the
attempt accepted by the database. Partial uploads and stale attempts cannot
replace live assets. Production promotion and rollback update a transactional
pointer; they do not rebuild. Rolling back code does not change environment
variables or restore external data. Promotion retains the build-time values of
the selected deployment; choose a production build when different public values
are required.

Sites use `d-<deployment UUID>.sites.example.com` and production uses
`p-<project UUID>.sites.example.com`. Use a dedicated site-serving domain, separate
from the dashboard's authentication origin. Do not scope dashboard cookies to
that domain. R2 must be private; do not enable public r2.dev access or a public
bucket custom domain. The router provides SPA fallback only for extensionless
navigation, and HTML/directory resolution plus genuine 404s for multipage exports.

## Build security and limits

- Repository checkout uses Git argv, HTTPS GitHub URLs, no hooks/submodules, and
  short-lived GitHub installation credentials for private repositories.
- Build scripts run as a non-root UID inside Docker with a read-only root,
  dropped capabilities, no Docker socket, no platform environment, 2 GiB memory,
  two CPUs, 256 processes, and bounded temporary storage.
- Only the checkout and a project/lockfile/image-specific dependency cache are
  mounted. Checkout/cache disk usage is bounded by the disposable runner's disk,
  not a per-project filesystem quota. Exhaustion fails that runner's job.
- The provided hosted workflow blocks private/metadata networks from containers.
  CI verifies host reachability before these rules and denial afterward, then
  builds the framework fixtures with the rules enabled. Local/self-hosted runners
  must provide equivalent network isolation.
- Fork pull requests are not built automatically. Same-repository contributors
  with write access can execute builds and access that project's build variables.
- Build deadline defaults to 900 seconds, including retries. Checkout has its own
  bounded Git command timeouts. Cancellation is observed through lease heartbeats.
- Artifacts: at most 10,000 files, 25 MiB per file, 100 MiB total; hidden files,
  symlinks, hard links, and escaped output directories are rejected.
- Default budgets: 20 builds/user/24h, 100 total builds/24h, 3 active builds/user,
  one hosted runner globally. `MAX_BUILDS_PER_DAY` and
  `MAX_TOTAL_BUILDS_PER_DAY` configure admission limits.
- `MAX_ARTIFACT_STORAGE_BYTES` defaults to 8,000,000,000 bytes. Uploads reserve
  bytes under a database lock; retries count separately, and failed uploads
  conservatively retain their reservation until cleanup. This budget covers new
  platform artifacts, not preexisting bucket objects, caches, database, or logs.
- Logs are redacted for known build variables and bounded to 1 MB / 5,000 lines.
- Expired artifacts are tombstoned before deletion. Deletion retries safely.
  Production and the latest three retained non-PR successes are preserved.
  Older builds expire after seven days; closed PR previews expire immediately
  and are cleaned on the next runner maintenance pass.
- The database is the durable job ledger. Redis failures leave jobs queued for
  reconciliation. Leases recover crashed workers and exhausted attempts fail
  visibly. GitHub's scheduled runner supplies recovery even when dispatch fails.

These controls reduce exposure; Docker is not a VM-per-tenant security boundary.
Keep the hosted service limited to trusted/invited users until its deployed
network isolation and abuse controls have been validated.

## Local validation

Install dependencies with `bun install --frozen-lockfile` inside `api`, `worker`,
`web`, and `edge`. Docker and Node 22+ are required for runtime/browser smoke tests.
Use a disposable database; never run tests against production.

```sh
docker run --name deploy-grid-test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=deploy_grid_test -p 127.0.0.1:55432:5432 -d postgres:16
# In api/
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/deploy_grid_test bun run db:migrate
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/deploy_grid_test bun test --preload ./test/setup.ts
bun run typecheck
bunx wrangler deploy --dry-run --outdir dist
# From repository root
 docker build -f worker/Dockerfile.build -t deploy-grid-builder:local worker
# In worker/
bun run typecheck
bun run test
bun scripts/isolation-smoke.ts
bun scripts/framework-smoke.ts
bun scripts/lifecycle-smoke.ts
# In edge/
bun run typecheck
bun test
bunx wrangler deploy --dry-run --outdir dist
node test/runtime-smoke.mjs
# In web/
bun run typecheck
bun run test
bunx playwright install chromium
bun run test:e2e
```

The runtime smoke test uses the bundled Workers source with Miniflare's installed
v4 conversion helper. It exercises a real workerd process and local R2 storage.
The four framework fixtures are genuine builds, not fabricated output folders.
Fixtures intentionally exercise Vite 6, Astro 5, and Next 16.1; other major versions
must pass compatibility tests before being advertised as supported.

The platform tables in migrations 0004–0006 are maintained through explicit SQL
migrations and repositories. Add changes to these tables as reviewed SQL migrations;
do not infer their schema from the older Drizzle model alone.

## Hosted setup (credentials required)

1. Choose the Cloudflare account, private R2 bucket, dedicated site domain, and
   dashboard URL. Replace the sample `sites.example.com` and bucket names in the
   Wrangler configs. Add a proxied wildcard DNS record and a Worker route for
   `*.YOUR_SITE_DOMAIN/*`. Configure TLS for that hostname depth (for a nested
   `sites.example.com` domain, verify wildcard certificate coverage explicitly).
2. Back up Neon, then apply the checked-in migrations once. Existing deployments
   receive metadata rows but must be rebuilt to use the new router. Keep existing
   infrastructure available until cutover tests pass.
3. Configure `api` Worker secrets with `bunx wrangler secret put NAME`:
   `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
   `PROJECT_ENV_ENCRYPTION_KEY`, `API_AUTH_TOKEN`, `ROUTING_SECRET`.
   Keep the existing encryption key to preserve readable project variables.
   Configure the same `ROUTING_SECRET` on `edge`.
4. Create a GitHub App with repository permissions: Contents read, Metadata read,
   Commit statuses write, and Actions write for dispatching the builder workflow.
   Subscribe to Push and Pull request webhooks. Webhook URL:
   `https://YOUR_API/webhooks/github`; configure a strong webhook secret.
   User authorization callback: `https://YOUR_DASHBOARD/api/github/callback`.
   Install on the builder repository and the repositories to deploy.
5. API secrets: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`. API configuration:
   `WEB_BASE_URL`, `GITHUB_RUNNER_REPOSITORY` (`owner/repo`),
   `GITHUB_RUNNER_INSTALLATION_ID`, `GITHUB_RUNNER_REF` (the reviewed release branch).
   The App installation on the builder repository needs Actions write access.
6. Dashboard server environment: `DEPLOY_GRID_API_URL`, `DEPLOY_GRID_API_TOKEN`
   (same value as `API_AUTH_TOKEN`), `GITHUB_CLIENT_ID`, `WEB_BASE_URL`; preserve
   existing Clerk configuration. The browser never receives the API token.
7. Configure `.github/workflows/builds.yml` repository secrets and variables as
   named in that file. `ARTIFACT_BASE_URL` is required by the existing storage
   client; preview links are sourced from the database's dedicated site URLs.
   Set `DEPLOY_GRID_BUILDS_ENABLED=true` only after the workflow and isolation
   rules are reviewed. The hourly schedule is a recovery backstop and may be
   delayed by GitHub. For private repositories, watch Actions usage/storage.
8. Deploy API then edge with their local `bunx wrangler deploy`, deploy the
   dashboard, and test public/private repo builds, GitHub OAuth, signed webhooks,
   branch pushes, PR previews, PR closure, production promotion and rollback.
9. Only after successful cutover disable the old Cloud Run builder/API and unused
   associated resources. This implementation does not delete existing resources.

Use named secrets in the provider UIs or local secret files; do not commit values.
No live GitHub App authorization/webhook test or Cloudflare deployment is implied
by passing local mocks, dry runs, or the Miniflare checks.
