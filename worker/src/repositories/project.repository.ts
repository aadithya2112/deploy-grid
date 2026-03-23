import { eq } from "drizzle-orm";
import type { Project } from "../db/schema.ts";
import { projects } from "../db/schema.ts";
import { db } from "../infrastructure/database.ts";

export class ProjectRepository {
  async findById(id: string): Promise<Project | null> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return project ?? null;
  }
}
