import { Redis } from "@upstash/redis";
import type { DeploymentJobMessage } from "../contracts/deployment-job.ts";
import { env } from "../config/env.ts";

export class DeploymentQueue {
  private readonly redis = new Redis({
    url: env.upstashRedisRestUrl,
    token: env.upstashRedisRestToken,
  });

  async enqueue(job: DeploymentJobMessage): Promise<void> {
    await this.redis.rpush(env.deploymentQueueName, JSON.stringify(job));
  }
}
