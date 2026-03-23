import { describe, expect, test } from "bun:test";
import { ProjectRoutes } from "./project.routes.ts";

describe("ProjectRoutes", () => {
  test("dispatches project collection routes", async () => {
    const create = async () => Response.json({ type: "create" }, { status: 201 });
    const list = async () => Response.json({ type: "list" }, { status: 200 });
    const routes = new ProjectRoutes({
      create,
      list,
      getById: async () => Response.json({}),
      update: async () => Response.json({}),
      createDeployment: async () => Response.json({}),
      listDeployments: async () => Response.json({}),
      listEnvVars: async () => Response.json({}),
      upsertEnvVar: async () => Response.json({}),
      deleteEnvVar: async () => new Response(null, { status: 204 }),
    } as never);

    const createResponse = await routes.handle(
      new Request("http://localhost/projects", { method: "POST" }),
    );
    const listResponse = await routes.handle(
      new Request("http://localhost/projects", { method: "GET" }),
    );

    expect(createResponse?.status).toBe(201);
    expect(await createResponse?.json()).toEqual({ type: "create" });
    expect(listResponse?.status).toBe(200);
    expect(await listResponse?.json()).toEqual({ type: "list" });
  });

  test("dispatches project item routes", async () => {
    const routes = new ProjectRoutes({
      create: async () => Response.json({}),
      list: async () => Response.json({}),
      getById: async (id: string) => Response.json({ id }),
      update: async (_request: Request, id: string) =>
        Response.json({ id, type: "update" }),
      createDeployment: async (_request: Request, id: string) =>
        Response.json({ id, type: "createDeployment" }, { status: 202 }),
      listDeployments: async (_request: Request, id: string) =>
        Response.json({ id, type: "listDeployments" }),
      listEnvVars: async (id: string) =>
        Response.json({ id, type: "listEnvVars" }),
      upsertEnvVar: async (_request: Request, id: string, key: string) =>
        Response.json({ id, key, type: "upsertEnvVar" }),
      deleteEnvVar: async (_request: Request, id: string, key: string) =>
        Response.json({ id, key, type: "deleteEnvVar" }),
    } as never);

    const getResponse = await routes.handle(
      new Request("http://localhost/projects/project-123", { method: "GET" }),
    );
    const createDeploymentResponse = await routes.handle(
      new Request("http://localhost/projects/project-123/deployments", {
        method: "POST",
      }),
    );
    const updateResponse = await routes.handle(
      new Request("http://localhost/projects/project-123", {
        method: "PATCH",
      }),
    );
    const listEnvVarsResponse = await routes.handle(
      new Request("http://localhost/projects/project-123/env-vars", {
        method: "GET",
      }),
    );
    const upsertEnvVarResponse = await routes.handle(
      new Request("http://localhost/projects/project-123/env-vars/API_KEY", {
        method: "PUT",
      }),
    );

    expect(await getResponse?.json()).toEqual({ id: "project-123" });
    expect(await createDeploymentResponse?.json()).toEqual({
      id: "project-123",
      type: "createDeployment",
    });
    expect(await updateResponse?.json()).toEqual({
      id: "project-123",
      type: "update",
    });
    expect(await listEnvVarsResponse?.json()).toEqual({
      id: "project-123",
      type: "listEnvVars",
    });
    expect(await upsertEnvVarResponse?.json()).toEqual({
      id: "project-123",
      key: "API_KEY",
      type: "upsertEnvVar",
    });
  });

  test("returns null for unknown project routes", async () => {
    const routes = new ProjectRoutes({} as never);

    const response = await routes.handle(
      new Request("http://localhost/projects/project-123/build-jobs", {
        method: "GET",
      }),
    );

    expect(response).toBeNull();
  });
});
