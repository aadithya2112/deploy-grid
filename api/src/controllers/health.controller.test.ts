import { describe, expect, test } from "bun:test";
import { HealthController } from "./health.controller.ts";

describe("HealthController", () => {
  test("returns 200 when the service is healthy", async () => {
    const controller = new HealthController({
      getHealth: async () => ({
        status: "ok",
        database: "ok",
      }),
    } as never);

    const response = await controller.get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      database: "ok",
    });
  });

  test("returns 503 when the service is degraded", async () => {
    const controller = new HealthController({
      getHealth: async () => ({
        status: "degraded",
        database: "error",
      }),
    } as never);

    const response = await controller.get();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "degraded",
      database: "error",
    });
  });
});
