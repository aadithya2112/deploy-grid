import { PlatformError, PlatformRepository } from "../repositories/platform.repository.ts";
import { requireRequestContext } from "../http/request-context.ts";
import { optionalEnum, optionalString, parseJsonBody, requireString } from "../http/validation.ts";
import { connectGitHub } from "../services/github.service.ts";
import type { DeploymentService } from "../services/deployment.service.ts";
const uuid = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
export class PlatformRoutes {
  constructor(private readonly deployments: DeploymentService, private readonly store = new PlatformRepository()) {}
  async handle(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    const project = new RegExp(`^/projects/${uuid}/(platform|promote|github|deployments)$`).exec(path);
    const deployment = new RegExp(`^/deployments/${uuid}/(cancel|redeploy)$`).exec(path);
    if (!project && !deployment) return null;
    if (project?.[2] === "deployments" && request.method !== "POST") return null;
    const { clerkUserId } = requireRequestContext(request);
    if (request.method === "GET" && project?.[2] === "platform") return Response.json(await this.store.overview(project[1]!, clerkUserId));
    if (request.method !== "POST") return null;
    const body = await parseJsonBody<Record<string, unknown>>(request, { allowEmpty: true });
    if (project?.[2] === "promote") return Response.json(await this.store.promote(project[1]!, requireString(body.deploymentId, "deploymentId"), clerkUserId));
    if (project?.[2] === "github") return Response.json(await connectGitHub(project[1]!, clerkUserId, requireString(body.code, "code")));
    if (project?.[2] === "deployments") {
      const result = await this.deployments.createDeploymentForProject(project[1]!, clerkUserId, optionalString(body.gitRef, "gitRef"), { environment: optionalEnum(body.environment, "environment", ["preview", "production"] as const) });
      return Response.json(result.toJSON(), { status: 202 });
    }
    if (deployment?.[2] === "cancel") return Response.json(await this.store.cancel(deployment[1]!, clerkUserId));
    if (deployment?.[2] === "redeploy") return Response.json((await this.deployments.redeployDeployment(deployment[1]!, clerkUserId)).toJSON(), { status: 202 });
    return null;
  }
}
