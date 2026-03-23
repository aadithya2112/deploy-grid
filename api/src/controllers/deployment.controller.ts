import {
  InvalidDeploymentRequestError,
  DeploymentNotFoundError,
  DeploymentProjectNotFoundError,
  type DeploymentService,
} from "../services/deployment.service.ts";
import {
  RequestValidationError,
  optionalNonNegativeIntParam,
  optionalString,
  parseJsonBody,
  parsePagination,
  requireString,
} from "../http/validation.ts";

interface CreateDeploymentBody {
  repoUrl?: string;
  gitRef?: string;
}

interface RedeployDeploymentBody {
  gitRef?: string;
}

export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  async create(request: Request): Promise<Response> {
    try {
      const body = await parseJsonBody<CreateDeploymentBody>(request);

      const deployment = await this.deploymentService.createDeployment(
        requireString(body.repoUrl, "repoUrl"),
        optionalString(body.gitRef, "gitRef"),
      );

      return Response.json(deployment.toJSON(), { status: 202 });
    } catch (error: unknown) {
      if (error instanceof InvalidDeploymentRequestError) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      if (error instanceof DeploymentProjectNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }

      if (error instanceof RequestValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      const message =
        error instanceof Error ? error.message : "Internal server error";

      return Response.json({ error: message }, { status: 500 });
    }
  }

  async getById(id: string): Promise<Response> {
    try {
      const deployment = await this.deploymentService.getDeployment(id);

      return Response.json(deployment.toJSON());
    } catch (error: unknown) {
      if (error instanceof DeploymentNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }

      if (error instanceof RequestValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  async getLogs(request: Request, id: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const { limit } = parsePagination(url.searchParams, {
        defaultLimit: 100,
        maxLimit: 500,
      });
      const afterSequence = optionalNonNegativeIntParam(
        url.searchParams,
        "afterSequence",
      );

      const logs = await this.deploymentService.getDeploymentLogs(id, {
        limit,
        afterSequence,
      });

      return Response.json({
        deploymentId: id,
        logs: logs.map((logEntry) => ({
          id: logEntry.id,
          deploymentId: logEntry.deploymentId,
          stream: logEntry.stream,
          sequence: logEntry.sequence,
          message: logEntry.message,
          createdAt: logEntry.createdAt.toISOString(),
        })),
      });
    } catch (error: unknown) {
      if (error instanceof DeploymentNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }

      if (error instanceof RequestValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  async redeploy(request: Request, id: string): Promise<Response> {
    try {
      const body = await parseJsonBody<RedeployDeploymentBody>(request, {
        allowEmpty: true,
      });
      const deployment = await this.deploymentService.redeployDeployment(
        id,
        optionalString(body.gitRef, "gitRef"),
      );

      return Response.json(deployment.toJSON(), { status: 202 });
    } catch (error: unknown) {
      if (error instanceof DeploymentNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }

      if (error instanceof RequestValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
  }
}
