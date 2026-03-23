import type { HealthController } from "../controllers/health.controller.ts";

export class HealthRoutes {
  constructor(private readonly controller: HealthController) {}

  async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return this.controller.get();
    }

    return null;
  }
}
