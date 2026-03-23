import { eq } from "drizzle-orm";
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
}
