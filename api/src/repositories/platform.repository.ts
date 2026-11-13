import { sql } from "../infrastructure/database.ts";
import type { Project } from "../db/schema.ts";
import type { Deployment } from "../domain/deployment.ts";

export interface DeploymentOptions {
  environment?: "preview" | "production";
  pullRequest?: number;
  eventKey?: string;
}
export class PlatformError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export class PlatformRepository {
  async createQueued(
    deployment: Deployment,
    project: Project,
    options: DeploymentOptions = {},
  ): Promise<{ id: string }> {
    return sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('deploy-grid-global-quota'))`;
      const [globalCount] =
        await tx`select count(*)::int as total from deployments where created_at > now() - interval '24 hours'`;
      if (
        Number(globalCount?.total) >=
        Number(process.env.MAX_TOTAL_BUILDS_PER_DAY ?? 100)
      )
        throw new PlatformError("Platform daily build allowance reached", 429);
      // Lock by owner to make quota checks correct under concurrent requests.
      await tx`select pg_advisory_xact_lock(hashtext(${project.clerkUserId ?? project.id}))`;
      if (options.eventKey) {
        const [existing] =
          await tx`select deployment_id from deployment_details where event_key = ${options.eventKey}`;
        if (existing) throw new PlatformError("Event already deployed", 409);
      }
      const [count] =
        await tx`select count(*)::int as total from deployments d join projects p on p.id=d.project_id where p.clerk_user_id=${project.clerkUserId} and d.created_at > now() - interval '24 hours'`;
      if (Number(count?.total) >= Number(process.env.MAX_BUILDS_PER_DAY ?? 20))
        throw new PlatformError("Daily build allowance reached", 429);
      const [active] =
        await tx`select count(*)::int as total from deployments d join projects p on p.id=d.project_id where p.clerk_user_id=${project.clerkUserId} and d.status in ('queued','building')`;
      if (Number(active?.total) >= 3)
        throw new PlatformError("Wait for your active builds to finish", 429);
      await tx`insert into deployments(id,project_id,status,git_ref,preview_url) values (${deployment.id},${project.id},'queued',${deployment.gitRef},${deployment.previewUrl})`;
      const [job] =
        await tx`insert into build_jobs(deployment_id) values (${deployment.id}) returning id`;
      await tx`insert into deployment_details(deployment_id,environment,settings,pull_request,event_key,expires_at) values (
        ${deployment.id},${options.environment ?? "preview"},${JSON.stringify({ rootDirectory: project.rootDirectory, installCommand: project.installCommand, buildCommand: project.buildCommand, outputDirectory: project.outputDirectory })}::jsonb,
        ${options.pullRequest ?? null},${options.eventKey ?? null},now() + interval '7 days')`;
      return { id: String(job!.id) };
    });
  }

  async overview(projectId: string, userId: string) {
    const [project] =
      await sql`select id from projects where id=${projectId} and clerk_user_id=${userId}`;
    if (!project) throw new PlatformError("Project not found", 404);
    const [release] =
      await sql`select deployment_id as "deploymentId", github_installation_id::text as "installationId", github_repository as repository from project_releases where project_id=${projectId}`;
    const history =
      await sql`select deployment_id as "deploymentId", actor, created_at as "createdAt" from release_events where project_id=${projectId} order by created_at desc limit 20`;
    const builds =
      await sql`select d.id, x.environment, x.framework, x.metrics, x.pull_request as "pullRequest", x.expires_at as "expiresAt", x.deleted_at as "deletedAt" from deployments d join deployment_details x on d.id=x.deployment_id where d.project_id=${projectId} order by d.created_at desc limit 100`;
    return {
      release: release ?? null,
      history,
      builds,
      productionUrl: process.env.SITES_DOMAIN
        ? `https://p-${projectId}.${process.env.SITES_DOMAIN}`
        : null,
    };
  }

  async promote(projectId: string, deploymentId: string, userId: string) {
    return sql.begin(async (tx) => {
      const [project] =
        await tx`select id from projects where id=${projectId} and clerk_user_id=${userId} for update`;
      if (!project) throw new PlatformError("Project not found", 404);
      const [build] =
        await tx`select d.id from deployments d join deployment_details x on d.id=x.deployment_id where d.id=${deploymentId} and d.project_id=${projectId} and d.status='ready' and x.artifact_prefix is not null and x.deleted_at is null for update of d,x`;
      if (!build)
        throw new PlatformError(
          "Only a ready, retained deployment from this project can be promoted",
          409,
        );
      await tx`insert into project_releases(project_id,deployment_id) values (${projectId},${deploymentId}) on conflict(project_id) do update set deployment_id=excluded.deployment_id, updated_at=now()`;
      await tx`insert into release_events(project_id,deployment_id,actor) values (${projectId},${deploymentId},${userId})`;
      return { deploymentId };
    });
  }

  async cancel(deploymentId: string, userId: string) {
    return sql.begin(async (tx) => {
      await tx`select p.id from projects p join deployments d on d.project_id=p.id where d.id=${deploymentId} and p.clerk_user_id=${userId} for update of p`;
      const [deployment] =
        await tx`update deployments d set status='cancelled',updated_at=now() from projects p where d.project_id=p.id and d.id=${deploymentId} and p.clerk_user_id=${userId} and d.status in ('queued','building') returning d.id`;
      if (!deployment)
        throw new PlatformError("Active deployment not found", 404);
      await tx`update build_jobs set status='failed',last_error='Cancelled by user',lease_until=null where deployment_id=${deploymentId}`;
      return { status: "cancelled" };
    });
  }

  async resolveSite(label: string) {
    const id = label.slice(2);
    const rows = label.startsWith("p-")
      ? await sql`select x.artifact_prefix as prefix,x.routing from project_releases r join deployments d on d.id=r.deployment_id join deployment_details x on x.deployment_id=d.id where r.project_id=${id} and d.status='ready' and x.deleted_at is null`
      : await sql`select x.artifact_prefix as prefix,x.routing from deployments d join deployment_details x on x.deployment_id=d.id where d.id=${id} and d.status='ready' and x.deleted_at is null`;
    return rows[0]?.prefix ? rows[0] : null;
  }
}
