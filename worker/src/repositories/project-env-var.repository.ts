import { eq } from "drizzle-orm";
import type { ProjectEnvVar } from "../db/schema.ts";
import { projectEnvVars } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class ProjectEnvVarRepository {
  async listByProjectId(projectId: string): Promise<ProjectEnvVar[]> {
    return db
      .select()
      .from(projectEnvVars)
      .where(eq(projectEnvVars.projectId, projectId));
  }
}
