import { describe, expect, test } from "bun:test";
import { DeploymentRoutes } from "./deployment.routes.ts";

describe("DeploymentRoutes", () => {
  test("dispatches POST /deployments to the controller", async () => {
    const create = async (request: Request) =>
      Response.json({ method: request.method }, { status: 202 });
    const getById = async () => Response.json({});
    const routes = new DeploymentRoutes({ create, getById } as never);

    const response = await routes.handle(
      new Request("http://localhost/deployments", { method: "POST" }),
    );

    expect(response?.status).toBe(202);
    expect(await response?.json()).toEqual({ method: "POST" });
  });

  test("dispatches GET /deployments/:id to the controller", async () => {
    const create = async () => Response.json({});
    const getById = async (id: string) => Response.json({ id }, { status: 200 });
    const routes = new DeploymentRoutes({ create, getById } as never);

    const response = await routes.handle(
      new Request("http://localhost/deployments/deploy-123", { method: "GET" }),
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ id: "deploy-123" });
  });

  test("returns null for unknown routes", async () => {
    const create = async () => Response.json({});
    const getById = async () => Response.json({});
    const routes = new DeploymentRoutes({ create, getById } as never);

    const response = await routes.handle(
      new Request("http://localhost/projects", { method: "GET" }),
    );

    expect(response).toBeNull();
  });

  test("dispatches GET /deployments/:id/logs to the controller", async () => {
    const create = async () => Response.json({});
    const getById = async () => Response.json({});
    const getLogs = async (_request: Request, id: string) =>
      Response.json({ id, type: "logs" }, { status: 200 });
    const routes = new DeploymentRoutes({ create, getById, getLogs } as never);

    const response = await routes.handle(
      new Request("http://localhost/deployments/deploy-123/logs", {
        method: "GET",
      }),
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ id: "deploy-123", type: "logs" });
  });

  test("dispatches POST /deployments/:id/redeploy to the controller", async () => {
    const create = async () => Response.json({});
    const getById = async () => Response.json({});
    const getLogs = async () => Response.json({});
    const redeploy = async (_request: Request, id: string) =>
      Response.json({ id, type: "redeploy" }, { status: 202 });
    const routes = new DeploymentRoutes({
      create,
      getById,
      getLogs,
      redeploy,
    } as never);

    const response = await routes.handle(
      new Request("http://localhost/deployments/deploy-123/redeploy", {
        method: "POST",
      }),
    );

    expect(response?.status).toBe(202);
    expect(await response?.json()).toEqual({
      id: "deploy-123",
      type: "redeploy",
    });
  });
});
