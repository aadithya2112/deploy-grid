import { eq, sql } from "drizzle-orm";
import type { BuildJob } from "../db/schema.ts";
import { buildJobs } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class BuildJobRepository {
  async create(deploymentId: string): Promise<BuildJob> {
    const [job] = await db
      .insert(buildJobs)
      .values({
        deploymentId,
      })
      .returning();

    if (!job) {
      throw new Error("Failed to create build job");
    }

    return job;
  }

  async markFailed(id: string, lastError: string): Promise<void> {
    await db
      .update(buildJobs)
      .set({
        status: "failed",
        lastError,
        updatedAt: new Date(),
      })
      .where(eq(buildJobs.id, id));
  }

  async findById(id: string): Promise<BuildJob | null> {
    const [job] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.id, id))
      .limit(1);

    return job ?? null;
  }

  async findByDeploymentId(deploymentId: string): Promise<BuildJob | null> {
    const [job] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.deploymentId, deploymentId))
      .limit(1);

    return job ?? null;
  }

  async markRunning(
    id: string,
    input: { claimedBy: string; leaseUntil: Date },
  ): Promise<void> {
    await db
      .update(buildJobs)
      .set({
        status: "running",
        claimedBy: input.claimedBy,
        leaseUntil: input.leaseUntil,
        attempts: sql`${buildJobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(buildJobs.id, id));
  }

  async refreshLease(id: string, leaseUntil: Date): Promise<void> {
    await db
      .update(buildJobs)
      .set({
        leaseUntil,
        updatedAt: new Date(),
      })
      .where(eq(buildJobs.id, id));
  }

  async markSucceeded(id: string): Promise<void> {
    await db
      .update(buildJobs)
      .set({
        status: "succeeded",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(buildJobs.id, id));
  }
}
