import type { DeploymentController } from "../controllers/deployment.controller.ts";

export class DeploymentRoutes {
  constructor(private readonly controller: DeploymentController) {}

  async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/deployments") {
      return this.controller.create(request);
    }

    const deploymentRedeployRoute = /^\/deployments\/([^/]+)\/redeploy$/.exec(
      url.pathname,
    );

    if (request.method === "POST" && deploymentRedeployRoute) {
      const [, id] = deploymentRedeployRoute;
      if (id) {
        return this.controller.redeploy(request, id);
      }
    }

    const deploymentLogsRoute = /^\/deployments\/([^/]+)\/logs$/.exec(url.pathname);

    if (request.method === "GET" && deploymentLogsRoute) {
      const [, id] = deploymentLogsRoute;
      if (id) {
        return this.controller.getLogs(request, id);
      }
    }

    const deploymentRoute = /^\/deployments\/([^/]+)$/.exec(url.pathname);

    if (request.method === "GET" && deploymentRoute) {
      const [, id] = deploymentRoute;
      if (id) {
        return this.controller.getById(id);
      }
    }

    return null;
  }
}
