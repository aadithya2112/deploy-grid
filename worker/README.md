# Build supervisor

The supervisor consumes the durable Postgres/Upstash job queue, checks out a GitHub
repository, and builds static sites in restricted Docker containers. Supported
adapters: React/Vite, Vue/Vite, Astro static, and Next.js static export.

See [the platform guide](../docs/STATIC_PLATFORM.md) for architecture, security
boundaries, configuration, and hosted setup. The hosted runner is GitHub Actions.
The old Cloud Run supervisor image is retired: it cannot run the Docker backend.

From the repository root:

```sh
docker build -f worker/Dockerfile.build -t deploy-grid-builder:local worker
```

From `worker/`, install with `bun install --frozen-lockfile`, configure `.env`
from `.env.example`, and run `bun run start:once` to drain queued work and perform
retention cleanup. The supervisor must run as a non-root user with Docker access.
Use a private R2 bucket; hosted site URLs are served by the edge Worker.

Validation commands:

```sh
bun run typecheck
bun run test
bun run test:isolation
bun run test:frameworks
bun run test:lifecycle
```

The lifecycle check requires the disposable local database described in the guide.
`bun run smoke` remains available to exercise a configured API and builder together;
set `API_BASE_URL`, `API_AUTH_TOKEN`, and `SMOKE_PROJECT_ID` for your test project.
