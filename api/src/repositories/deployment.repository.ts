import { asc, desc, eq } from "drizzle-orm";
import { Deployment } from "../domain/deployment.ts";
import type { DeploymentSnapshot } from "../domain/deployment.types.ts";
import { deployments, projects } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toSnapshot(
  row: typeof deployments.$inferSelect,
  repoUrl: string,
): DeploymentSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    repoUrl,
    gitRef: row.gitRef,
    status: row.status,
    commitSha: row.commitSha,
    previewUrl: row.previewUrl,
    artifactUrl: row.artifactUrl,
    buildStartedAt: toIsoString(row.buildStartedAt),
    buildFinishedAt: toIsoString(row.buildFinishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    errorMessage: row.errorMessage,
  };
}

export class DeploymentRepository {
  async create(deployment: Deployment): Promise<void> {
    await db.insert(deployments).values({
      id: deployment.id,
      projectId: deployment.projectId,
      status: deployment.status,
      gitRef: deployment.gitRef,
      commitSha: deployment.commitSha,
      previewUrl: deployment.previewUrl,
      artifactUrl: deployment.artifactUrl,
      buildStartedAt: deployment.buildStartedAt
        ? new Date(deployment.buildStartedAt)
        : null,
      buildFinishedAt: deployment.buildFinishedAt
        ? new Date(deployment.buildFinishedAt)
        : null,
      createdAt: new Date(deployment.createdAt),
      updatedAt: new Date(deployment.updatedAt),
      errorMessage: deployment.errorMessage,
    });
  }

  async findById(id: string): Promise<Deployment | null> {
    const [row] = await db
      .select({
        deployment: deployments,
        repoUrl: projects.repoUrl,
      })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(eq(deployments.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return Deployment.hydrate(toSnapshot(row.deployment, row.repoUrl));
  }

  async update(deployment: Deployment): Promise<void> {
    await db
      .update(deployments)
      .set({
        status: deployment.status,
        gitRef: deployment.gitRef,
        commitSha: deployment.commitSha,
        previewUrl: deployment.previewUrl,
        artifactUrl: deployment.artifactUrl,
        buildStartedAt: deployment.buildStartedAt
          ? new Date(deployment.buildStartedAt)
          : null,
        buildFinishedAt: deployment.buildFinishedAt
          ? new Date(deployment.buildFinishedAt)
          : null,
        updatedAt: new Date(deployment.updatedAt),
        errorMessage: deployment.errorMessage,
      })
      .where(eq(deployments.id, deployment.id));
  }

  async listByProjectId(
    projectId: string,
    options: { limit: number; offset: number },
  ): Promise<Deployment[]> {
    const rows = await db
      .select({
        deployment: deployments,
        repoUrl: projects.repoUrl,
      })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(eq(deployments.projectId, projectId))
      .orderBy(desc(deployments.createdAt), asc(deployments.id))
      .limit(options.limit)
      .offset(options.offset);

    return rows.map((row) =>
      Deployment.hydrate(toSnapshot(row.deployment, row.repoUrl)),
    );
  }

  async findLatestByProjectId(projectId: string): Promise<Deployment | null> {
    const [row] = await db
      .select({
        deployment: deployments,
        repoUrl: projects.repoUrl,
      })
      .from(deployments)
      .innerJoin(projects, eq(deployments.projectId, projects.id))
      .where(eq(deployments.projectId, projectId))
      .orderBy(desc(deployments.createdAt), asc(deployments.id))
      .limit(1);

    if (!row) {
      return null;
    }

    return Deployment.hydrate(toSnapshot(row.deployment, row.repoUrl));
  }
}
