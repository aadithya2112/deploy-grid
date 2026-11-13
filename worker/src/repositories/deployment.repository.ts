import { eq } from "drizzle-orm";
import type { Deployment } from "../db/schema.ts";
import { deployments } from "../db/schema.ts";
import { db, sql as postgresClient } from "../infrastructure/database.ts";

function toTimestamp(value: Date): string {
  return value.toISOString();
}

export class DeploymentRepository {
  async findById(id: string): Promise<Deployment | null> {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);

    if (!deployment) return null;
    const [detail] = await postgresClient`select x.environment,x.settings,r.github_installation_id::text as installation from deployment_details x join deployments d on d.id=x.deployment_id left join project_releases r on r.project_id=d.project_id where x.deployment_id=${id}`;
    return { ...deployment, environment: detail?.environment ?? "preview", settings: detail?.settings, githubInstallationId: detail?.installation };
  }

  async markBuilding(id: string, now: Date): Promise<void> {
    await postgresClient`
      update deployments
      set
        status = 'building',
        build_started_at = coalesce(build_started_at, ${toTimestamp(now)}),
        error_message = null,
        updated_at = ${toTimestamp(now)}
      where id = ${id}
        and status in ('queued', 'building')
    `;
  }

  async updateCommitSha(id: string, commitSha: string, now: Date): Promise<void> {
    await postgresClient`
      update deployments
      set
        commit_sha = ${commitSha},
        updated_at = ${toTimestamp(now)}
      where id = ${id}
    `;
  }

  async markReady(
    id: string,
    input: { commitSha: string; artifactUrl: string; now: Date },
  ): Promise<void> {
    await postgresClient`
      update deployments
      set
        status = 'ready',
        commit_sha = ${input.commitSha},
        artifact_url = ${input.artifactUrl},
        error_message = null,
        build_finished_at = ${toTimestamp(input.now)},
        updated_at = ${toTimestamp(input.now)}
      where id = ${id}
    `;
  }

  async markFailed(id: string, errorMessage: string, now: Date): Promise<void> {
    await postgresClient`
      update deployments
      set
        status = 'failed',
        error_message = ${errorMessage},
        build_finished_at = ${toTimestamp(now)},
        updated_at = ${toTimestamp(now)}
      where id = ${id}
    `;
  }
}
