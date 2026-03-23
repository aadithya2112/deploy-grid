const runtimeEnv =
  typeof Bun !== "undefined" ? { ...process.env, ...Bun.env } : process.env;

function requireEnv(name: string): string {
  const value = runtimeEnv[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const env = {
  databaseUrl: requireEnv("DATABASE_URL"),
  upstashRedisRestUrl: requireEnv("UPSTASH_REDIS_REST_URL"),
  upstashRedisRestToken: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  deploymentQueueName: runtimeEnv.DEPLOYMENT_QUEUE_NAME ?? "deployment_jobs",
  port: Number(runtimeEnv.PORT ?? 3000),
  deploymentPreviewBaseUrl:
    runtimeEnv.DEPLOYMENT_PREVIEW_BASE_URL?.replace(/\/+$/, "") ?? null,
};
