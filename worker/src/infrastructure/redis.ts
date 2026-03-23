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

export class DeploymentQueue {
  constructor(
    private readonly redis = new Redis({
      url: env.upstashRedisRestUrl,
      token: env.upstashRedisRestToken,
    }),
    private readonly queueName = env.deploymentQueueName,
  ) {}

  async pop(): Promise<DeploymentJobMessage | null> {
    const payload = await this.redis.lpop<string>(this.queueName);

    if (!payload) {
      return null;
    }

    const parsed = JSON.parse(payload) as unknown;

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

  async enqueue(message: DeploymentJobMessage): Promise<void> {
    await this.redis.rpush(this.queueName, JSON.stringify(message));
  }
}
