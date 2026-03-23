import { sql as sqlFragment } from "drizzle-orm";
import { db } from "../infrastructure/database.ts";
import { buildJobs, deployments } from "../db/schema.ts";

function toTimestamp(value: Date): string {
  return value.toISOString();
}

export class WorkerStateRepository {
  async markBuilding(deploymentId: string, now: Date): Promise<void> {
    await db
      .update(deployments)
      .set({
        status: "building",
        buildStartedAt: sqlFragment`coalesce(${deployments.buildStartedAt}, ${toTimestamp(now)})`,
        errorMessage: null,
        updatedAt: now,
      })
      .where(
        sqlFragment`${deployments.id} = ${deploymentId} and ${deployments.status} in ('queued', 'building')`,
      );
  }

  async finalizeSuccess(input: {
    deploymentId: string;
    buildJobId: string;
    claimedBy: string;
    commitSha: string;
    artifactUrl: string;
    now: Date;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(deployments)
        .set({
          status: "ready",
          commitSha: input.commitSha,
          artifactUrl: input.artifactUrl,
          errorMessage: null,
          buildFinishedAt: input.now,
          updatedAt: input.now,
        })
        .where(sqlFragment`${deployments.id} = ${input.deploymentId}`);

      await tx
        .update(buildJobs)
        .set({
          status: "succeeded",
          lastError: null,
          leaseUntil: null,
          updatedAt: input.now,
        })
        .where(
          sqlFragment`${buildJobs.id} = ${input.buildJobId} and ${buildJobs.claimedBy} = ${input.claimedBy}`,
        );
    });
  }

  async finalizeFailure(input: {
    deploymentId: string;
    buildJobId: string;
    claimedBy: string;
    errorMessage: string;
    now: Date;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(deployments)
        .set({
          status: "failed",
          errorMessage: input.errorMessage,
          buildFinishedAt: input.now,
          updatedAt: input.now,
        })
        .where(sqlFragment`${deployments.id} = ${input.deploymentId}`);

      await tx
        .update(buildJobs)
        .set({
          status: "failed",
          lastError: input.errorMessage,
          leaseUntil: null,
          updatedAt: input.now,
        })
        .where(
          sqlFragment`${buildJobs.id} = ${input.buildJobId} and ${buildJobs.claimedBy} = ${input.claimedBy}`,
        );
    });
  }

  async failExpiredRunningJob(input: {
    deploymentId: string;
    buildJobId: string;
    errorMessage: string;
    now: Date;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(deployments)
        .set({
          status: "failed",
          errorMessage: input.errorMessage,
          buildFinishedAt: input.now,
          updatedAt: input.now,
        })
        .where(sqlFragment`${deployments.id} = ${input.deploymentId}`);

      await tx
        .update(buildJobs)
        .set({
          status: "failed",
          lastError: input.errorMessage,
          leaseUntil: null,
          updatedAt: input.now,
        })
        .where(sqlFragment`${buildJobs.id} = ${input.buildJobId}`);
    });
  }
}
