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

  async processUntilIdle(): Promise<{ processed: number }> {
    await this.recoveryLoop.runOnce();

    let processed = 0;

    while (true) {
      const message = await this.queue.pop();

      if (!message) {
        break;
      }

      try {
        await this.jobProcessor.process(message);
        processed += 1;
      } catch (error) {
        logger.error("Deployment job processing failed", {
          buildJobId: message.buildJobId,
          deploymentId: message.deploymentId,
          error: error instanceof Error ? error.message : "Unknown job error",
        });
      }
    }

    logger.info("Queue drained", {
      processed,
      workerId: env.workerId,
    });

    return { processed };
  }
}
