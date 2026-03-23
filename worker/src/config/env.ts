const runtimeEnv =
  typeof Bun !== "undefined" ? { ...process.env, ...Bun.env } : process.env;

function requireEnv(name: string): string {
  const value = runtimeEnv[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function optionalEnv(name: string): string | null {
  const value = runtimeEnv[name]?.trim();
  return value ? value : null;
}

function integerEnv(name: string, defaultValue: number): number {
  const rawValue = runtimeEnv[name];

  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

const artifactBaseUrl = optionalEnv("ARTIFACT_BASE_URL")?.replace(/\/+$/, "") ?? null;
const r2PublicBaseUrl = optionalEnv("R2_PUBLIC_BASE_URL")?.replace(/\/+$/, "") ?? null;

if (!artifactBaseUrl && !r2PublicBaseUrl) {
  throw new Error("Either ARTIFACT_BASE_URL or R2_PUBLIC_BASE_URL is required");
}

export const env = {
  databaseUrl: requireEnv("DATABASE_URL"),
  upstashRedisRestUrl: requireEnv("UPSTASH_REDIS_REST_URL"),
  upstashRedisRestToken: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  deploymentQueueName: optionalEnv("DEPLOYMENT_QUEUE_NAME") ?? "deployment_jobs",
  projectEnvEncryptionKey: requireEnv("PROJECT_ENV_ENCRYPTION_KEY"),
  workerId: requireEnv("WORKER_ID"),
  workerTmpDir: requireEnv("WORKER_TMP_DIR"),
  buildJobLeaseSeconds: integerEnv("BUILD_JOB_LEASE_SECONDS", 60),
  heartbeatIntervalSeconds: integerEnv("HEARTBEAT_INTERVAL_SECONDS", 20),
  maxBuildAttempts: integerEnv("MAX_BUILD_ATTEMPTS", 3),
  queuePollIntervalMs: integerEnv("QUEUE_POLL_INTERVAL_MS", 5_000),
  recoveryIntervalSeconds: integerEnv("RECOVERY_INTERVAL_SECONDS", 30),
  buildTimeoutSeconds: integerEnv("BUILD_TIMEOUT_SECONDS", 900),
  transientCommandRetryLimit: integerEnv("TRANSIENT_COMMAND_RETRY_LIMIT", 2),
  transientCommandRetryDelayMs: integerEnv("TRANSIENT_COMMAND_RETRY_DELAY_MS", 1_000),
  artifactBaseUrl,
  artifactBucket: requireEnv("ARTIFACT_BUCKET"),
  artifactAccessKey: requireEnv("ARTIFACT_ACCESS_KEY"),
  artifactSecretKey: requireEnv("ARTIFACT_SECRET_KEY"),
  r2S3Endpoint: requireEnv("R2_S3_ENDPOINT"),
  r2PublicBaseUrl,
};

export type Env = typeof env;
