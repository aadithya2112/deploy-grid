import { eq } from "drizzle-orm";
import type { NewProject, Project } from "../db/schema.ts";
import { projects } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class ProjectRepository {
  async createOrGet(values: Pick<NewProject, "slug" | "name" | "repoUrl">): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(values)
      .onConflictDoUpdate({
        target: projects.repoUrl,
        set: {
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!project) {
      throw new Error("Failed to create or load project");
    }

    return project;
  }

  async findByRepoUrl(repoUrl: string): Promise<Project | null> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.repoUrl, repoUrl))
      .limit(1);

    return project ?? null;
  }
}
