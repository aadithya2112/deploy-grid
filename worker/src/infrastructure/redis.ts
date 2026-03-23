import { Redis } from "@upstash/redis";
import { env } from "../config/env.ts";
import type { DeploymentJobMessage } from "../contracts/deployment-job.ts";

function isDeploymentJobMessage(value: unknown): value is DeploymentJobMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.buildJobId === "string" &&
    typeof candidate.deploymentId === "string" &&
    typeof candidate.projectId === "string" &&
    typeof candidate.repoUrl === "string" &&
    typeof candidate.gitRef === "string"
  );
}

function normalizeDeploymentJobMessage(value: unknown): DeploymentJobMessage {
  const parsed =
    typeof value === "string" ? (JSON.parse(value) as unknown) : value;

  if (!isDeploymentJobMessage(parsed)) {
    throw new Error("Received invalid deployment job payload");
  }

  return {
    buildJobId: parsed.buildJobId,
    deploymentId: parsed.deploymentId,
    projectId: parsed.projectId,
    repoUrl: parsed.repoUrl,
    gitRef: parsed.gitRef,
    rootDirectory:
      typeof parsed.rootDirectory === "string" ? parsed.rootDirectory : null,
    installCommand:
      typeof parsed.installCommand === "string" ? parsed.installCommand : null,
    buildCommand:
      typeof parsed.buildCommand === "string" ? parsed.buildCommand : null,
    outputDirectory:
      typeof parsed.outputDirectory === "string" ? parsed.outputDirectory : null,
  };
}

interface RedisLike {
  lpop<T>(key: string): Promise<T | null>;
  rpush(key: string, value: string): Promise<unknown>;
}

export class DeploymentQueue {
  constructor(
    private readonly redis: RedisLike = new Redis({
      url: env.upstashRedisRestUrl,
      token: env.upstashRedisRestToken,
    }),
    private readonly queueName = env.deploymentQueueName,
  ) {}

  async pop(): Promise<DeploymentJobMessage | null> {
    const payload = await this.redis.lpop<unknown>(this.queueName);

    if (!payload) {
      return null;
    }

    return normalizeDeploymentJobMessage(payload);
  }

  async enqueue(message: DeploymentJobMessage): Promise<void> {
    await this.redis.rpush(this.queueName, JSON.stringify(message));
  }
}

export { normalizeDeploymentJobMessage };
