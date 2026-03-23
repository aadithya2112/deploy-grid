import { sql } from "../infrastructure/database.ts";

export interface HealthSnapshot {
  status: "ok" | "degraded";
  database: "ok" | "error";
}

export class HealthService {
  async getHealth(): Promise<HealthSnapshot> {
    try {
      await sql`select 1`;

      return {
        status: "ok",
        database: "ok",
      };
    } catch {
      return {
        status: "degraded",
        database: "error",
      };
    }
  }
}
