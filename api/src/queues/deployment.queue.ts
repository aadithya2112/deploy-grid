import { Redis } from "@upstash/redis";
import type { DeploymentJobMessage } from "../contracts/deployment-job.ts";
import { env } from "../config/env.ts";

export class DeploymentQueue {
  constructor(
    private readonly redis: Pick<Redis, "rpush"> = new Redis({
      url: env.upstashRedisRestUrl,
      token: env.upstashRedisRestToken,
    }),
    private readonly queueName: string = env.deploymentQueueName,
  ) {}

  async enqueue(job: DeploymentJobMessage): Promise<void> {
    await this.redis.rpush(this.queueName, JSON.stringify(job));
  }
}
