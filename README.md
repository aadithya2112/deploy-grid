# Deploy Grid

A static deployment platform with framework detection, isolated builds, GitHub
previews, production promotion, and rollback without rebuilding.

**Supported:** React/Vite, Vue/Vite, Astro static, Next.js static export.
SSR and runtime backend servers are intentionally outside this release.

- **Dashboard:** Next.js + Clerk, build logs, release management, environment variables.
- **API:** Cloudflare Workers (or Bun locally), Neon/PostgreSQL, Upstash queue.
- **Builder:** credentialed supervisor on an ephemeral GitHub Actions runner;
  repository code runs inside restricted Docker containers.
- **Delivery:** Cloudflare Worker + private R2, separate deployment hostnames,
  SPA/multipage routing, immutable artifacts and transactional production aliases.
- **Reliability:** transactional job creation, duplicate webhook handling,
  job leases, recovery, cancellation, publication fencing and retryable cleanup.
- **Cost controls:** build admission quotas, dependency caching, artifact limits,
  storage reservations, log limits and preview retention.

## Workflow

Connect a GitHub repository, create a deployment, inspect its build logs, and
promote a successful build. GitHub integration deploys default-branch pushes to
production and creates previews for same-repository PRs. A previous retained
build can be promoted to roll back without rebuilding.

## Development and deployment

See [the static platform guide](docs/STATIC_PLATFORM.md) for architecture, security
boundaries, local verification, environment variables, GitHub App setup, and the
Cloudflare cutover procedure. [Implementation tracking](docs/IMPLEMENTATION.md)
records the intended release scope.

The repository includes real framework fixtures, unit/integration tests, browser
tests, a Workers runtime smoke test, and Docker isolation/lifecycle tests. CI runs
these checks without production credentials.

Hosted activation requires configuring the GitHub App, secrets, private bucket,
and site domain. Checked-in example configuration is not a live deployment.
