import { BunCommandRunner } from "./src/build/command-runner.ts";
import { checkoutRepository } from "./src/build/repository-checkout.ts";
import { env } from "./src/config/env.ts";
import { ArtifactStorage } from "./src/infrastructure/r2.ts";
import { logger } from "./src/infrastructure/logger.ts";
import { DeploymentQueue } from "./src/infrastructure/redis.ts";
import { BuildJobRepository } from "./src/repositories/build-job.repository.ts";
import { DeploymentLogRepository } from "./src/repositories/deployment-log.repository.ts";
import { DeploymentRepository } from "./src/repositories/deployment.repository.ts";
import { ProjectEnvVarRepository } from "./src/repositories/project-env-var.repository.ts";
import { ProjectRepository } from "./src/repositories/project.repository.ts";
import { WorkerStateRepository } from "./src/repositories/worker-state.repository.ts";
import { JobProcessor } from "./src/services/job-processor.ts";
import { RecoveryLoop } from "./src/services/recovery-loop.ts";
import { WorkerService } from "./src/services/worker.ts";

const deploymentQueue = new DeploymentQueue();
const buildJobRepository = new BuildJobRepository();
const deploymentRepository = new DeploymentRepository();
const projectRepository = new ProjectRepository();
const projectEnvVarRepository = new ProjectEnvVarRepository();
const deploymentLogRepository = new DeploymentLogRepository();
const workerStateRepository = new WorkerStateRepository();
const artifactStorage = new ArtifactStorage();
const commandRunner = new BunCommandRunner();

const jobProcessor = new JobProcessor({
  buildJobRepository,
  deploymentRepository,
  projectRepository,
  projectEnvVarRepository,
  deploymentLogRepository,
  workerStateRepository,
  artifactStorage,
  commandRunner,
  checkoutRepository,
});

const recoveryLoop = new RecoveryLoop({
  buildJobRepository,
  workerStateRepository,
  deploymentLogRepository,
  queue: deploymentQueue,
});

const workerService = new WorkerService(
  deploymentQueue,
  jobProcessor,
  recoveryLoop,
);

const abortController = new AbortController();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info("Received shutdown signal", { signal, workerId: env.workerId });
    abortController.abort();
  });
}

logger.info("Starting deployment worker", {
  workerId: env.workerId,
  queueName: env.deploymentQueueName,
});

await recoveryLoop.runOnce();
await workerService.run(abortController.signal);