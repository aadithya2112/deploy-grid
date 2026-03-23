import { asc, eq } from "drizzle-orm";
import type { NewProject, Project } from "../db/schema.ts";
import { projects } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class ProjectRepository {
  async createOrGet(
    values: Pick<
      NewProject,
      | "slug"
      | "name"
      | "repoUrl"
      | "defaultBranch"
      | "rootDirectory"
      | "installCommand"
      | "buildCommand"
      | "outputDirectory"
    >,
  ): Promise<Project> {
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

  async create(
    values: Pick<
      NewProject,
      | "slug"
      | "name"
      | "repoUrl"
      | "defaultBranch"
      | "rootDirectory"
      | "installCommand"
      | "buildCommand"
      | "outputDirectory"
    >,
  ): Promise<Project> {
    const [project] = await db.insert(projects).values(values).returning();

    if (!project) {
      throw new Error("Failed to create project");
    }

    return project;
  }

  async findById(id: string): Promise<Project | null> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    return project ?? null;
  }

  async findByRepoUrl(repoUrl: string): Promise<Project | null> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.repoUrl, repoUrl))
      .limit(1);

    return project ?? null;
  }

  async list(options: { limit: number; offset: number }): Promise<Project[]> {
    return db
      .select()
      .from(projects)
      .orderBy(asc(projects.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  }

  async updateSettings(
    id: string,
    values: Partial<
      Pick<
        NewProject,
        | "name"
        | "defaultBranch"
        | "rootDirectory"
        | "installCommand"
        | "buildCommand"
        | "outputDirectory"
      >
    >,
  ): Promise<Project | null> {
    const [project] = await db
      .update(projects)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    return project ?? null;
  }
}
