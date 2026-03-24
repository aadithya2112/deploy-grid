# api

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Docker

Build the image:

```bash
docker build -t deploy-grid-api .
```

Run the container:

```bash
docker run --rm -p 3000:3000 \
	-e DATABASE_URL=... \
	-e UPSTASH_REDIS_REST_URL=... \
	-e UPSTASH_REDIS_REST_TOKEN=... \
	-e API_AUTH_TOKEN=... \
	deploy-grid-api
```

Health endpoint:

```bash
curl http://localhost:3000/health
```

> Note: run database migrations separately with `bun run db:migrate` before or during deployment.
