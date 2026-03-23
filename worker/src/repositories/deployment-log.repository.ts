import { eq, sql } from "drizzle-orm";
import type { DeploymentLog, LogStream } from "../db/schema.ts";
import { deploymentLogs } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class DeploymentLogRepository {
  async getNextSequence(deploymentId: string): Promise<number> {
    const [row] = await db
      .select({
        nextSequence: sql<number>`coalesce(max(${deploymentLogs.sequence}) + 1, 1)`,
      })
      .from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, deploymentId));

    return row?.nextSequence ?? 1;
  }

  async append(entry: {
    deploymentId: string;
    stream: LogStream;
    sequence: number;
    message: string;
  }): Promise<DeploymentLog> {
    const [logEntry] = await db.insert(deploymentLogs).values(entry).returning();

    if (!logEntry) {
      throw new Error("Failed to append deployment log");
    }

    return logEntry;
  }
}
