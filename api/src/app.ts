import { env } from "./config/env.ts";
import { DeploymentController } from "./controllers/deployment.controller.ts";
import { HealthController } from "./controllers/health.controller.ts";
import { ProjectController } from "./controllers/project.controller.ts";
import { logger } from "./infrastructure/logger.ts";
import { BuildJobRepository } from "./repositories/build-job.repository.ts";
import { DeploymentRepository } from "./repositories/deployment.repository.ts";
import { DeploymentLogRepository } from "./repositories/deployment-log.repository.ts";
import { ProjectEnvVarRepository } from "./repositories/project-env-var.repository.ts";
import { ProjectRepository } from "./repositories/project.repository.ts";
import { DeploymentQueue } from "./queues/deployment.queue.ts";
import { DeploymentRoutes } from "./routes/deployment.routes.ts";
import { HealthRoutes } from "./routes/health.routes.ts";
import { ProjectRoutes } from "./routes/project.routes.ts";
import { DeploymentService } from "./services/deployment.service.ts";
import { HealthService } from "./services/health.service.ts";
import { ProjectService } from "./services/project.service.ts";

const repository = new DeploymentRepository();
const projectRepository = new ProjectRepository();
const buildJobRepository = new BuildJobRepository();
const deploymentLogRepository = new DeploymentLogRepository();
const projectEnvVarRepository = new ProjectEnvVarRepository();
const deploymentQueue = new DeploymentQueue();
const service = new DeploymentService(
  repository,
  projectRepository,
  buildJobRepository,
  deploymentLogRepository,
  deploymentQueue,
);
const projectService = new ProjectService(
  projectRepository,
  projectEnvVarRepository,
  service,
);
const controller = new DeploymentController(service);
const projectController = new ProjectController(projectService);
const healthController = new HealthController(new HealthService());
const routes = [
  new HealthRoutes(healthController),
  new ProjectRoutes(projectController),
  new DeploymentRoutes(controller),
];
const port = env.port;

const server = Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    for (const route of routes) {
      const response = await route.handle(request);

      if (response) {
        return response;
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

logger.info("Deployment API listening", {
  port: server.port,
});

export default server;
