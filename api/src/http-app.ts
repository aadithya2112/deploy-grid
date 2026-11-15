import { PlatformRoutes } from "./routes/platform.routes.ts";
import {
  PlatformError,
  PlatformRepository,
} from "./repositories/platform.repository.ts";
import { handleGitHubWebhook } from "./services/github.service.ts";
import { RequestValidationError } from "./http/validation.ts";
import { RequestContextError } from "./http/request-context.ts";
import { env } from "./config/env.ts";
import { DeploymentController } from "./controllers/deployment.controller.ts";
import { HealthController } from "./controllers/health.controller.ts";
import { ProjectController } from "./controllers/project.controller.ts";
import { authorizeRequest } from "./http/auth.ts";
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
  new PlatformRoutes(service),
  new HealthRoutes(healthController),
  new ProjectRoutes(projectController),
  new DeploymentRoutes(controller),
];
const port = env.port;

export async function handleRequest(request: Request): Promise<Response> {
  try {
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && path === "/webhooks/github")
      return await handleGitHubWebhook(request, service);
    if (path.startsWith("/internal/sites/")) {
      const authError = authorizeRequest(request, {
        expectedToken: process.env.ROUTING_SECRET ?? null,
        publicPaths: [],
      });
      if (authError) return authError;
      const label = path.slice("/internal/sites/".length);
      if (
        !/^[dp]-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          label,
        )
      )
        return new Response(null, { status: 404 });
      const site = await new PlatformRepository().resolveSite(label);
      return site
        ? Response.json(site, { headers: { "Cache-Control": "no-store" } })
        : new Response(null, { status: 404 });
    }

    const authError = authorizeRequest(request);

    if (authError) {
      return authError;
    }

    for (const route of routes) {
      const response = await route.handle(request);

      if (response) {
        return response;
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    const status =
      error instanceof PlatformError
        ? error.status
        : error instanceof RequestContextError
          ? 401
          : error instanceof RequestValidationError
            ? 400
            : 500;
    if (status === 500)
      console.error("API request failed", {
        error: error instanceof Error ? error.name : "unknown",
      });
    return Response.json(
      {
        error:
          status === 500 ? "Internal server error" : (error as Error).message,
      },
      { status },
    );
  }
}
