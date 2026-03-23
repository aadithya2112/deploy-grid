import {
  InvalidDeploymentRequestError,
  DeploymentNotFoundError,
  type DeploymentService,
} from "../services/deployment.service.ts";

interface CreateDeploymentBody {
  repoUrl?: string;
  gitRef?: string;
}

export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  async create(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as CreateDeploymentBody;

      if (typeof body.repoUrl !== "string") {
        return Response.json(
          { error: "repoUrl must be a string" },
          { status: 400 },
        );
      }

      if (body.gitRef !== undefined && typeof body.gitRef !== "string") {
        return Response.json(
          { error: "gitRef must be a string" },
          { status: 400 },
        );
      }

      const deployment = await this.deploymentService.createDeployment(
        body.repoUrl,
        body.gitRef,
      );

      return Response.json(deployment.toJSON(), { status: 202 });
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return Response.json({ error: "Invalid request body" }, { status: 400 });
      }

      if (error instanceof InvalidDeploymentRequestError) {
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

      const message = error instanceof Error ? error.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
  }
}
