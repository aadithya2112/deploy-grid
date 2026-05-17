import { BunCommandRunner } from "./src/build/command-runner.ts"
import { checkoutRepository } from "./src/build/repository-checkout.ts"
import { env } from "./src/config/env.ts"
import { ArtifactStorage } from "./src/infrastructure/r2.ts"
import { logger } from "./src/infrastructure/logger.ts"
import { DeploymentQueue } from "./src/infrastructure/redis.ts"
import { BuildJobRepository } from "./src/repositories/build-job.repository.ts"
import { DeploymentLogRepository } from "./src/repositories/deployment-log.repository.ts"
import { DeploymentRepository } from "./src/repositories/deployment.repository.ts"
import { ProjectEnvVarRepository } from "./src/repositories/project-env-var.repository.ts"
import { ProjectRepository } from "./src/repositories/project.repository.ts"
import { WorkerStateRepository } from "./src/repositories/worker-state.repository.ts"
import { JobProcessor } from "./src/services/job-processor.ts"
import { RecoveryLoop } from "./src/services/recovery-loop.ts"
import { WorkerService } from "./src/services/worker.ts"

const cloudRunPort = Number(process.env.PORT ?? 8080)

const deploymentQueue = new DeploymentQueue()
const buildJobRepository = new BuildJobRepository()
const deploymentRepository = new DeploymentRepository()
const projectRepository = new ProjectRepository()
const projectEnvVarRepository = new ProjectEnvVarRepository()
const deploymentLogRepository = new DeploymentLogRepository()
const workerStateRepository = new WorkerStateRepository()
const artifactStorage = new ArtifactStorage()
const commandRunner = new BunCommandRunner()

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
})

const recoveryLoop = new RecoveryLoop({
  buildJobRepository,
  workerStateRepository,
  deploymentLogRepository,
  queue: deploymentQueue,
})

const workerService = new WorkerService(
  deploymentQueue,
  jobProcessor,
  recoveryLoop,
)

let processChain: Promise<{ processed: number }> = Promise.resolve({ processed: 0 })

function scheduleProcessUntilIdle(): Promise<{ processed: number }> {
  const next = processChain.then(() => workerService.processUntilIdle())
  processChain = next.catch(() => ({ processed: 0 }))
  return next
}

const WORKER_WAKE_TOKEN_HEADER = "X-Worker-Wake-Token"

function isAuthorized(request: Request): boolean {
  if (!env.workerWakeSecret) {
    return true
  }

  return request.headers.get(WORKER_WAKE_TOKEN_HEADER) === env.workerWakeSecret
}

const server = Bun.serve({
  port: cloudRunPort,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok" }, { status: 200 })
    }

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json(
        { service: "deploy-grid-worker", status: "idle" },
        { status: 200 },
      )
    }

    if (request.method === "POST" && url.pathname === "/internal/process") {
      if (!isAuthorized(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
      }

      void scheduleProcessUntilIdle().catch((error) => {
        logger.error("Background queue processing failed", {
          error: error instanceof Error ? error.message : "Unknown process error",
        })
      })

      return Response.json({ status: "accepted" }, { status: 202 })
    }

    return Response.json({ error: "Not found" }, { status: 404 })
  },
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info("Received shutdown signal, waiting for active builds", {
      signal,
      workerId: env.workerId,
    })
    void processChain.finally(() => {
      server.stop(true)
    })
  })
}

logger.info("Deployment worker listening for wake requests", {
  workerId: env.workerId,
  queueName: env.deploymentQueueName,
  port: server.port,
  wakeAuthEnabled: Boolean(env.workerWakeSecret),
})
