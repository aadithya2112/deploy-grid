process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/deploy_grid_test";
process.env.UPSTASH_REDIS_REST_URL ??= "https://example.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";
process.env.DEPLOYMENT_QUEUE_NAME ??= "deployment_jobs_test";
process.env.PROJECT_ENV_ENCRYPTION_KEY ??= "test-project-env-encryption-key";

process.env.WORKER_WAKE_URL = "";
process.env.WORKER_WAKE_SECRET = "";
process.env.GITHUB_RUNNER_REPOSITORY = "";
process.env.GITHUB_RUNNER_INSTALLATION_ID = "";
process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
process.env.PROJECT_ENV_ENCRYPTION_KEY = "test-encryption-key";
