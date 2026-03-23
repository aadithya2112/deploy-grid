process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/deploy_grid_test";
process.env.UPSTASH_REDIS_REST_URL ??= "https://example.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";
process.env.DEPLOYMENT_QUEUE_NAME ??= "deployment_jobs_test";
