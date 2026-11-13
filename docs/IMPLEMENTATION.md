# Static platform implementation

Scope: React/Vite, Vue/Vite, Astro static, and Next.js export. No hosted SSR.

Implementation sequence:
1. Fail-closed authentication, isolated build execution, framework adapters, artifact manifests.
2. Cloudflare API and site delivery, versioned assets, atomic promotion and rollback.
3. GitHub App integration, verified/deduplicated webhooks, push/PR deployments and cleanup.
4. Build quotas, caching, metrics, retention, recovery, dashboard controls.
5. Local end-to-end verification, CI, deployment documentation, hosted configuration.

Build execution runs on an ephemeral GitHub Actions runner inside a restricted Docker
container. The supervisor owns credentials; repository install/build scripts do not.
The previous Cloud Run service cannot run this Docker backend. Do not deploy the new
builder there or fall back to unsandboxed execution. Local Docker is supported.

Neon and Upstash are retained initially to preserve the tested queue/recovery model.
The API and site delivery move to Workers; R2 remains artifact storage. A future
Queues adapter is independent of the static platform release.

Hosted activation requires a Cloudflare account/domain, GitHub App credentials,
GitHub Actions secrets, and the existing database/storage credentials. Configure
these only after local tests pass. No production migrations run during local tests.
