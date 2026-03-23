import { describe, expect, test } from "bun:test";
import { HealthRoutes } from "./health.routes.ts";

describe("HealthRoutes", () => {
  test("dispatches GET /health", async () => {
    const routes = new HealthRoutes({
      get: async () => Response.json({ status: "ok" }),
    } as never);

    const response = await routes.handle(
      new Request("http://localhost/health", { method: "GET" }),
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ status: "ok" });
  });

  test("returns null for unrelated routes", async () => {
    const routes = new HealthRoutes({
      get: async () => Response.json({ status: "ok" }),
    } as never);

    const response = await routes.handle(
      new Request("http://localhost/health", { method: "POST" }),
    );

    expect(response).toBeNull();
  });
});
