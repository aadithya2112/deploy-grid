import { eq } from "drizzle-orm";
import type { Deployment } from "../db/schema.ts";
import { deployments } from "../db/schema.ts";
import { db, sql as postgresClient } from "../infrastructure/database.ts";

export class DeploymentRepository {
  async findById(id: string): Promise<Deployment | null> {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, id))
      .limit(1);

    return deployment ?? null;
  }

  async markBuilding(id: string, now: Date): Promise<void> {
    await postgresClient`
      update deployments
      set
        status = 'building',
        build_started_at = coalesce(build_started_at, ${now}),
        error_message = null,
        updated_at = ${now}
      where id = ${id}
        and status in ('queued', 'building')
    `;
  }

  async updateCommitSha(id: string, commitSha: string, now: Date): Promise<void> {
    await postgresClient`
      update deployments
      set
        commit_sha = ${commitSha},
        updated_at = ${now}
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
        build_finished_at = ${input.now},
        updated_at = ${input.now}
      where id = ${id}
    `;
  }

  async markFailed(id: string, errorMessage: string, now: Date): Promise<void> {
    await postgresClient`
      update deployments
      set
        status = 'failed',
        error_message = ${errorMessage},
        build_finished_at = ${now},
        updated_at = ${now}
      where id = ${id}
    `;
  }
}
