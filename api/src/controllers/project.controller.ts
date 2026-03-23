import { ProjectNotFoundError, InvalidProjectRequestError, type ProjectService } from "../services/project.service.ts";

interface CreateProjectBody {
  repoUrl?: string;
  name?: string;
  defaultBranch?: string;
  rootDirectory?: string | null;
  installCommand?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
}

interface CreateProjectDeploymentBody {
  gitRef?: string;
}

interface UpsertEnvVarBody {
  value?: string;
  target?: "all" | "preview" | "production";
}

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  async create(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as CreateProjectBody;

      if (typeof body.repoUrl !== "string") {
        return Response.json(
          { error: "repoUrl must be a string" },
          { status: 400 },
        );
      }

      if (body.name !== undefined && typeof body.name !== "string") {
        return Response.json({ error: "name must be a string" }, { status: 400 });
      }

      if (
        body.defaultBranch !== undefined &&
        typeof body.defaultBranch !== "string"
      ) {
        return Response.json(
          { error: "defaultBranch must be a string" },
          { status: 400 },
        );
      }

      for (const [field, value] of Object.entries({
        rootDirectory: body.rootDirectory,
        installCommand: body.installCommand,
        buildCommand: body.buildCommand,
        outputDirectory: body.outputDirectory,
      })) {
        if (value !== undefined && value !== null && typeof value !== "string") {
          return Response.json(
            { error: `${field} must be a string or null` },
            { status: 400 },
          );
        }
      }

      const project = await this.projectService.createProject({
        repoUrl: body.repoUrl,
        name: body.name,
        defaultBranch: body.defaultBranch,
        rootDirectory: body.rootDirectory,
        installCommand: body.installCommand,
        buildCommand: body.buildCommand,
        outputDirectory: body.outputDirectory,
      });
      return Response.json(project, { status: 201 });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async list(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const offset = Number(url.searchParams.get("offset") ?? "0");

      if (!Number.isFinite(limit) || limit <= 0) {
        return Response.json(
          { error: "limit must be a positive number" },
          { status: 400 },
        );
      }

      if (!Number.isFinite(offset) || offset < 0) {
        return Response.json(
          { error: "offset must be a non-negative number" },
          { status: 400 },
        );
      }

      const projects = await this.projectService.listProjects({ limit, offset });
      return Response.json({ projects });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async getById(id: string): Promise<Response> {
    try {
      const project = await this.projectService.getProject(id);
      return Response.json(project);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async createDeployment(request: Request, projectId: string): Promise<Response> {
    try {
      const rawBody = await request.text();
      const body = rawBody
        ? (JSON.parse(rawBody) as CreateProjectDeploymentBody)
        : {};

      if (body.gitRef !== undefined && typeof body.gitRef !== "string") {
        return Response.json(
          { error: "gitRef must be a string" },
          { status: 400 },
        );
      }

      const deployment = await this.projectService.createDeployment(
        projectId,
        body.gitRef,
      );

      return Response.json(deployment.toJSON(), { status: 202 });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async listDeployments(request: Request, projectId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const offset = Number(url.searchParams.get("offset") ?? "0");

      if (!Number.isFinite(limit) || limit <= 0) {
        return Response.json(
          { error: "limit must be a positive number" },
          { status: 400 },
        );
      }

      if (!Number.isFinite(offset) || offset < 0) {
        return Response.json(
          { error: "offset must be a non-negative number" },
          { status: 400 },
        );
      }

      const deployments = await this.projectService.listDeployments(projectId, {
        limit,
        offset,
      });

      return Response.json({
        projectId,
        deployments: deployments.map((deployment) => deployment.toJSON()),
      });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async listEnvVars(projectId: string): Promise<Response> {
    try {
      const envVars = await this.projectService.listEnvVars(projectId);
      return Response.json({ projectId, envVars });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async upsertEnvVar(
    request: Request,
    projectId: string,
    key: string,
  ): Promise<Response> {
    try {
      const body = (await request.json()) as UpsertEnvVarBody;

      if (typeof body.value !== "string") {
        return Response.json(
          { error: "value must be a string" },
          { status: 400 },
        );
      }

      if (
        body.target !== undefined &&
        !["all", "preview", "production"].includes(body.target)
      ) {
        return Response.json(
          { error: "target must be one of: all, preview, production" },
          { status: 400 },
        );
      }

      const envVar = await this.projectService.upsertEnvVar(projectId, {
        key,
        value: body.value,
        target: body.target,
      });

      return Response.json(envVar, { status: 201 });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async deleteEnvVar(
    request: Request,
    projectId: string,
    key: string,
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      const target = (url.searchParams.get("target") ?? "all") as
        | "all"
        | "preview"
        | "production";

      if (!["all", "preview", "production"].includes(target)) {
        return Response.json(
          { error: "target must be one of: all, preview, production" },
          { status: 400 },
        );
      }

      await this.projectService.deleteEnvVar(projectId, key, target);
      return new Response(null, { status: 204 });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private handleError(error: unknown): Response {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (error instanceof ProjectNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof InvalidProjectRequestError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
