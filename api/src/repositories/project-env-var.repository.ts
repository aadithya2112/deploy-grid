import { and, asc, eq } from "drizzle-orm";
import type { NewProjectEnvVar, ProjectEnvVar } from "../db/schema.ts";
import { projectEnvVars } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class ProjectEnvVarRepository {
  async upsert(
    values: Pick<NewProjectEnvVar, "projectId" | "key" | "value" | "target">,
  ): Promise<ProjectEnvVar> {
    const [envVar] = await db
      .insert(projectEnvVars)
      .values(values)
      .onConflictDoUpdate({
        target: [
          projectEnvVars.projectId,
          projectEnvVars.key,
          projectEnvVars.target,
        ],
        set: {
          value: values.value,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!envVar) {
      throw new Error("Failed to upsert project env var");
    }

    return envVar;
  }

  async listByProjectId(projectId: string): Promise<ProjectEnvVar[]> {
    return db
      .select()
      .from(projectEnvVars)
      .where(eq(projectEnvVars.projectId, projectId))
      .orderBy(asc(projectEnvVars.key), asc(projectEnvVars.target));
  }

  async delete(
    projectId: string,
    key: string,
    target: ProjectEnvVar["target"],
  ): Promise<void> {
    await db
      .delete(projectEnvVars)
      .where(
        and(
          eq(projectEnvVars.projectId, projectId),
          eq(projectEnvVars.key, key),
          eq(projectEnvVars.target, target),
        ),
      );
  }
}
