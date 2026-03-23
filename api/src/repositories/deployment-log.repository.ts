import { and, asc, eq, gt } from "drizzle-orm";
import type { DeploymentLog, NewDeploymentLog } from "../db/schema.ts";
import { deploymentLogs } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class DeploymentLogRepository {
  async append(entry: Pick<NewDeploymentLog, "deploymentId" | "stream" | "sequence" | "message">): Promise<DeploymentLog> {
    const [logEntry] = await db.insert(deploymentLogs).values(entry).returning();

    if (!logEntry) {
      throw new Error("Failed to append deployment log");
    }

    return logEntry;
  }

  async listByDeploymentId(
    deploymentId: string,
    options: { limit: number; afterSequence?: number },
  ): Promise<DeploymentLog[]> {
    if (options.afterSequence !== undefined) {
      return db
        .select()
        .from(deploymentLogs)
        .where(
          and(
            eq(deploymentLogs.deploymentId, deploymentId),
            gt(deploymentLogs.sequence, options.afterSequence),
          ),
        )
        .orderBy(asc(deploymentLogs.sequence))
        .limit(options.limit);
    }

    return db
      .select()
      .from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, deploymentId))
      .orderBy(asc(deploymentLogs.sequence))
      .limit(options.limit);
  }
}
