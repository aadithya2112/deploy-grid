import type { HealthService } from "../services/health.service.ts";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  async get(): Promise<Response> {
    const health = await this.healthService.getHealth();

    return Response.json(health, {
      status: health.status === "ok" ? 200 : 503,
    });
  }
}
