import { DeploymentController } from "./controllers/deployment.controller.ts";
import { logger } from "./infrastructure/logger.ts";
import { BuildJobRepository } from "./repositories/build-job.repository.ts";
import { DeploymentRepository } from "./repositories/deployment.repository.ts";
import { ProjectRepository } from "./repositories/project.repository.ts";
import { DeploymentQueue } from "./queues/deployment.queue.ts";
import { DeploymentRoutes } from "./routes/deployment.routes.ts";
import { DeploymentService } from "./services/deployment.service.ts";

const repository = new DeploymentRepository();
const projectRepository = new ProjectRepository();
const buildJobRepository = new BuildJobRepository();
const deploymentQueue = new DeploymentQueue();
const service = new DeploymentService(
  repository,
  projectRepository,
  buildJobRepository,
  deploymentQueue,
);
const controller = new DeploymentController(service);
const routes = new DeploymentRoutes(controller);
const port = Number(Bun.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const response = await routes.handle(request);

    if (response) {
      return response;
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

logger.info("Deployment API listening", {
  port: server.port,
});

export default server;
