import { setTimeout as sleep } from "node:timers/promises";
import { env } from "../config/env.ts";
import type { DeploymentQueue } from "../infrastructure/redis.ts";
import { logger } from "../infrastructure/logger.ts";
import { JobProcessor } from "./job-processor.ts";
import { RecoveryLoop } from "./recovery-loop.ts";

export class WorkerService {
  constructor(
    private readonly queue: DeploymentQueue,
    private readonly jobProcessor: JobProcessor,
    private readonly recoveryLoop: RecoveryLoop,
  ) {}

  async run(signal?: AbortSignal): Promise<void> {
    const recoveryTimer = setInterval(() => {
      void this.recoveryLoop.runOnce().catch((error) => {
        logger.error("Recovery loop iteration failed", {
          error: error instanceof Error ? error.message : "Unknown recovery error",
        });
      });
    }, env.recoveryIntervalSeconds * 1_000);

    try {
      while (!signal?.aborted) {
        const message = await this.queue.pop();

        if (!message) {
          await sleep(env.queuePollIntervalMs);
          continue;
        }

        try {
          await this.jobProcessor.process(message);
        } catch (error) {
          logger.error("Deployment job processing failed", {
            buildJobId: message.buildJobId,
            deploymentId: message.deploymentId,
            error: error instanceof Error ? error.message : "Unknown job error",
          });
        }
      }
    } finally {
      clearInterval(recoveryTimer);
    }
  }
}
