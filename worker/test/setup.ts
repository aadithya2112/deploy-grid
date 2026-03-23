import { mkdir } from "node:fs/promises";
import path from "node:path";

const testTmpRoot = path.join(process.cwd(), ".tmp");

await mkdir(testTmpRoot, { recursive: true });

const testEnv = {
  DATABASE_URL:
    "postgresql://user:password@localhost:5432/deploy_grid?sslmode=disable",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-token",
  DEPLOYMENT_QUEUE_NAME: "deployment_jobs_test",
  PROJECT_ENV_ENCRYPTION_KEY: "test-encryption-key",
  WORKER_ID: "test-worker",
  WORKER_TMP_DIR: path.join(testTmpRoot, `worker-${process.pid}`),
  BUILD_JOB_LEASE_SECONDS: "60",
  HEARTBEAT_INTERVAL_SECONDS: "1",
  MAX_BUILD_ATTEMPTS: "3",
  QUEUE_POLL_INTERVAL_MS: "10",
  RECOVERY_INTERVAL_SECONDS: "1",
  BUILD_TIMEOUT_SECONDS: "30",
  TRANSIENT_COMMAND_RETRY_LIMIT: "2",
  TRANSIENT_COMMAND_RETRY_DELAY_MS: "1",
  ARTIFACT_BASE_URL: "https://artifacts.example.com",
  ARTIFACT_BUCKET: "deploy-grid-test",
  ARTIFACT_ACCESS_KEY: "test-access-key",
  ARTIFACT_SECRET_KEY: "test-secret-key",
  R2_S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  R2_PUBLIC_BASE_URL: "https://pub.example.com",
} as const;

for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] = value;
  Bun.env[key] = value;
}
