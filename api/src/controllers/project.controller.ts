import { ProjectNotFoundError, InvalidProjectRequestError, type ProjectService } from "../services/project.service.ts";
import { RequestContextError, requireRequestContext } from "../http/request-context.ts";
import {
  RequestValidationError,
  optionalEnum,
  optionalNullableString,
  optionalString,
  parseJsonBody,
  parsePagination,
  requireString,
} from "../http/validation.ts";

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

interface UpdateProjectBody {
  name?: string;
  defaultBranch?: string;
  rootDirectory?: string | null;
  installCommand?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
}

interface UpsertEnvVarBody {
  value?: string;
  target?: "all" | "preview" | "production";
}

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  async create(request: Request): Promise<Response> {
    try {
      const { clerkUserId } = requireRequestContext(request);
      const body = await parseJsonBody<CreateProjectBody>(request);

      const project = await this.projectService.createProject(clerkUserId, {
        repoUrl: requireString(body.repoUrl, "repoUrl"),
        name: optionalString(body.name, "name"),
        defaultBranch: optionalString(body.defaultBranch, "defaultBranch"),
        rootDirectory: optionalNullableString(body.rootDirectory, "rootDirectory"),
        installCommand: optionalNullableString(body.installCommand, "installCommand"),
        buildCommand: optionalNullableString(body.buildCommand, "buildCommand"),
        outputDirectory: optionalNullableString(body.outputDirectory, "outputDirectory"),
      });
      return Response.json(project, { status: 201 });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async list(request: Request): Promise<Response> {
    try {
      const { clerkUserId } = requireRequestContext(request);
      const url = new URL(request.url);
      const { limit, offset } = parsePagination(url.searchParams);
      const query = url.searchParams.get("query")?.trim() || undefined;
      const projects = await this.projectService.listProjects({
        clerkUserId,
        limit: limit + 1,
        offset,
        query,
      });
      const visibleProjects = projects.slice(0, limit);

      return Response.json({
        projects: visibleProjects,
        pageInfo: {
          limit,
          offset,
          hasMore: projects.length > limit,
          nextOffset: projects.length > limit ? offset + limit : null,
        },
      });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async getById(request: Request, id: string): Promise<Response> {
    try {
      const { clerkUserId } = requireRequestContext(request);
      const project = await this.projectService.getProject(clerkUserId, id);
      return Response.json(project);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async createDeployment(request: Request, projectId: string): Promise<Response> {
    try {
      const { clerkUserId } = requireRequestContext(request);
      const body = await parseJsonBody<CreateProjectDeploymentBody>(request, {
        allowEmpty: true,
      });

      const deployment = await this.projectService.createDeployment(
        clerkUserId,
        projectId,
        optionalString(body.gitRef, "gitRef"),
      );

      return Response.json(deployment.toJSON(), { status: 202 });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async listDeployments(request: Request, projectId: string): Promise<Response> {
    try {
      const { clerkUserId } = requireRequestContext(request);
      const url = new URL(request.url);
      const { limit, offset } = parsePagination(url.searchParams);
      const status = optionalEnum(
        url.searchParams.get("status") ?? undefined,
        "status",
        ["queued", "building", "ready", "failed", "cancelled"] as const,
      );
      const gitRef = url.searchParams.get("gitRef")?.trim() || undefined;

      const deployments = await this.projectService.listDeployments(
        clerkUserId,
        projectId,
        {
          limit: limit + 1,
          offset,
          status,
          gitRef,
        },
      );
      const visibleDeployments = deployments.slice(0, limit);

      return Response.json({
        projectId,
        deployments: visibleDeployments.map((deployment) => deployment.toJSON()),
        pageInfo: {
          limit,
          offset,
          hasMore: deployments.length > limit,
          nextOffset: deployments.length > limit ? offset + limit : null,
        },
      });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async update(request: Request, projectId: string): Promise<Response> {
    try {
      const { clerkUserId } = requireRequestContext(request);
      const body = await parseJsonBody<UpdateProjectBody>(request);
      const project = await this.projectService.updateProject(clerkUserId, projectId, {
        name: optionalString(body.name, "name"),
        defaultBranch: optionalString(body.defaultBranch, "defaultBranch"),
        rootDirectory: optionalNullableString(body.rootDirectory, "rootDirectory"),
        installCommand: optionalNullableString(body.installCommand, "installCommand"),
        buildCommand: optionalNullableString(body.buildCommand, "buildCommand"),
        outputDirectory: optionalNullableString(body.outputDirectory, "outputDirectory"),
      });

      return Response.json(project);
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async listEnvVars(request: Request, projectId: string): Promise<Response> {
    try {
      const { clerkUserId } = requireRequestContext(request);
      const envVars = await this.projectService.listEnvVars(clerkUserId, projectId);
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
      const { clerkUserId } = requireRequestContext(request);
      const body = await parseJsonBody<UpsertEnvVarBody>(request);

      const envVar = await this.projectService.upsertEnvVar(clerkUserId, projectId, {
        key,
        value: requireString(body.value, "value"),
        target: optionalEnum(body.target, "target", [
          "all",
          "preview",
          "production",
        ] as const),
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
      const { clerkUserId } = requireRequestContext(request);
      const url = new URL(request.url);
      const target =
        optionalEnum(url.searchParams.get("target") ?? undefined, "target", [
          "all",
          "preview",
          "production",
        ] as const) ?? "all";

      await this.projectService.deleteEnvVar(clerkUserId, projectId, key, target);
      return new Response(null, { status: 204 });
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private handleError(error: unknown): Response {
    if (error instanceof ProjectNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    if (
      error instanceof RequestContextError ||
      error instanceof InvalidProjectRequestError ||
      error instanceof RequestValidationError
    ) {
      return Response.json(
        { error: error.message },
        { status: error instanceof RequestContextError ? 401 : 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
