import { and, asc, eq, ilike, or } from "drizzle-orm";
import type { NewProject, Project } from "../db/schema.ts";
import { projects } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class ProjectRepository {
  async createOrGet(
    values: Pick<
      NewProject,
      | "clerkUserId"
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
        target: [projects.clerkUserId, projects.repoUrl],
        set: {
          slug: values.slug,
          name: values.name,
          defaultBranch: values.defaultBranch,
          rootDirectory: values.rootDirectory,
          installCommand: values.installCommand,
          buildCommand: values.buildCommand,
          outputDirectory: values.outputDirectory,
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
      | "clerkUserId"
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

  async findById(id: string, clerkUserId?: string): Promise<Project | null> {
    const conditions = [eq(projects.id, id)];

    if (clerkUserId !== undefined) {
      conditions.push(eq(projects.clerkUserId, clerkUserId));
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(and(...conditions))
      .limit(1);

    return project ?? null;
  }

  async findByRepoUrl(repoUrl: string, clerkUserId?: string): Promise<Project | null> {
    const conditions = [eq(projects.repoUrl, repoUrl)];

    if (clerkUserId !== undefined) {
      conditions.push(eq(projects.clerkUserId, clerkUserId));
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(and(...conditions))
      .limit(1);

    return project ?? null;
  }

  async list(options: {
    clerkUserId: string;
    limit: number;
    offset: number;
    query?: string;
  }): Promise<Project[]> {
    const conditions = [eq(projects.clerkUserId, options.clerkUserId)];

    if (options.query?.trim()) {
      const search = `%${options.query.trim()}%`;
      return db
        .select()
        .from(projects)
        .where(
          and(
            ...conditions,
            or(
              ilike(projects.name, search),
              ilike(projects.slug, search),
              ilike(projects.repoUrl, search),
            )!,
          ),
        )
        .orderBy(asc(projects.createdAt))
        .limit(options.limit)
        .offset(options.offset);
    }

    return db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(asc(projects.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  }

  async updateSettings(
    id: string,
    clerkUserId: string,
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
      .where(and(eq(projects.id, id), eq(projects.clerkUserId, clerkUserId)))
      .returning();

    return project ?? null;
  }
}
