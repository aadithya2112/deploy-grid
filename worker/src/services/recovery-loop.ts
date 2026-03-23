import { env } from "../config/env.ts";
import type { DeploymentJobMessage } from "../contracts/deployment-job.ts";
import { logger } from "../infrastructure/logger.ts";
import { BuildJobRepository } from "../repositories/build-job.repository.ts";
import {
  DeploymentLogWriter,
  type DeploymentLogRepositoryLike,
} from "./deployment-log-writer.ts";

interface RecoveryQueue {
  enqueue(message: DeploymentJobMessage): Promise<void>;
}

interface RecoveryLoopDependencies {
  buildJobRepository: Pick<
    BuildJobRepository,
    "listRecoveryCandidates" | "listExceededRunningJobs"
  >;
  workerStateRepository: {
    failExpiredRunningJob(input: {
      deploymentId: string;
      buildJobId: string;
      errorMessage: string;
      now: Date;
    }): Promise<void>;
  };
  deploymentLogRepository: DeploymentLogRepositoryLike;
  queue: RecoveryQueue;
  now?: () => Date;
}

export class RecoveryLoop {
  constructor(private readonly dependencies: RecoveryLoopDependencies) {}

  async runOnce(): Promise<void> {
    const now = this.dependencies.now?.() ?? new Date();
    const staleQueuedBefore = new Date(now.getTime() - env.buildJobLeaseSeconds * 1_000);

    const [recoveryCandidates, exceededRunningJobs] = await Promise.all([
      this.dependencies.buildJobRepository.listRecoveryCandidates({
        staleQueuedBefore,
        now,
        maxAttempts: env.maxBuildAttempts,
        limit: 25,
      }),
      this.dependencies.buildJobRepository.listExceededRunningJobs(
        now,
        env.maxBuildAttempts,
      ),
    ]);

    for (const candidate of recoveryCandidates) {
      await this.dependencies.queue.enqueue({
        buildJobId: candidate.buildJobId,
        deploymentId: candidate.deploymentId,
        projectId: candidate.projectId,
        repoUrl: candidate.repoUrl,
        gitRef: candidate.gitRef,
        rootDirectory: candidate.rootDirectory,
        installCommand: candidate.installCommand,
        buildCommand: candidate.buildCommand,
        outputDirectory: candidate.outputDirectory,
      });

      logger.info("Re-enqueued recoverable build job", {
        buildJobId: candidate.buildJobId,
        deploymentId: candidate.deploymentId,
        status: candidate.status,
      });
    }

    for (const job of exceededRunningJobs) {
      const errorMessage = `Build job exceeded the max attempts (${env.maxBuildAttempts})`;

      await this.dependencies.workerStateRepository.failExpiredRunningJob({
        deploymentId: job.deploymentId,
        buildJobId: job.id,
        errorMessage,
        now,
      });

      const logWriter = new DeploymentLogWriter(
        this.dependencies.deploymentLogRepository,
        job.deploymentId,
      );

      await logWriter.system(`deployment marked failed: ${errorMessage}`);
    }
  }
}
