import type { ProjectController } from "../controllers/project.controller.ts";

export class ProjectRoutes {
  constructor(private readonly controller: ProjectController) {}

  async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/projects") {
      return this.controller.create(request);
    }

    if (request.method === "GET" && url.pathname === "/projects") {
      return this.controller.list(request);
    }

    const projectEnvVarRoute = /^\/projects\/([^/]+)\/env-vars\/([^/]+)$/.exec(
      url.pathname,
    );

    if (projectEnvVarRoute) {
      const [, projectId, key] = projectEnvVarRoute;

      if (projectId && key) {
        if (request.method === "PUT") {
          return this.controller.upsertEnvVar(
            request,
            projectId,
            decodeURIComponent(key),
          );
        }

        if (request.method === "DELETE") {
          return this.controller.deleteEnvVar(
            request,
            projectId,
            decodeURIComponent(key),
          );
        }
      }
    }

    const projectEnvVarsRoute = /^\/projects\/([^/]+)\/env-vars$/.exec(
      url.pathname,
    );

    if (request.method === "GET" && projectEnvVarsRoute) {
      const [, projectId] = projectEnvVarsRoute;
      if (projectId) {
        return this.controller.listEnvVars(projectId);
      }
    }

    const projectDeploymentsRoute = /^\/projects\/([^/]+)\/deployments$/.exec(
      url.pathname,
    );

    if (projectDeploymentsRoute) {
      const [, projectId] = projectDeploymentsRoute;
      if (projectId) {
        if (request.method === "POST") {
          return this.controller.createDeployment(request, projectId);
        }

        if (request.method === "GET") {
          return this.controller.listDeployments(request, projectId);
        }
      }
    }

    const projectRoute = /^\/projects\/([^/]+)$/.exec(url.pathname);

    if (request.method === "GET" && projectRoute) {
      const [, id] = projectRoute;
      if (id) {
        return this.controller.getById(id);
      }
    }

    return null;
  }
}
