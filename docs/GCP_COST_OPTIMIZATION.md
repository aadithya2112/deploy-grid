# GCP cost optimization (deploy-grid)

## What changed

- **Worker** scales to zero (`min-instances=0`), request-based CPU (`cpu-throttling`), 900s timeout.
- **Wake-on-enqueue**: API calls `POST /internal/process` after Redis enqueue; worker drains the queue then idles.
- **UI** deployment poll interval: 15s (was 2s).

## Cloud Run env (production)

| Service | Variable | Source |
|---------|----------|--------|
| `deploy-grid-api` | `WORKER_WAKE_URL` | `https://deploy-grid-worker-1065531003122.asia-south1.run.app/internal/process` |
| Both | `WORKER_WAKE_SECRET` | Secret Manager `WORKER_WAKE_SECRET` |

API service account (`1065531003122-compute@developer.gserviceaccount.com`) has `roles/run.invoker` on the worker.

## Billing account

Projects on billing account `01E65A-0B0F3E-A0BA44`:

- `deploy-grid` (this app)
- `adk-learning-467802`
- `gen-lang-client-0352601905`

Filter [Billing Reports](https://console.cloud.google.com/billing) by **Project** to see deploy-grid costs separately.

## Local development

```bash
# worker
WORKER_WAKE_SECRET=dev-secret bun run start

# api
WORKER_WAKE_URL=http://localhost:8080/internal/process
WORKER_WAKE_SECRET=dev-secret
```

Build images for Cloud Run (amd64):

```bash
docker build --platform linux/amd64 -t asia-south1-docker.pkg.dev/deploy-grid/deploy-grid/worker:TAG ./worker
docker build --platform linux/amd64 -t asia-south1-docker.pkg.dev/deploy-grid/deploy-grid/api:TAG ./api
```
