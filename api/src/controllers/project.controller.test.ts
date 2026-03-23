import { describe, expect, test } from "bun:test";
import { ProjectController } from "./project.controller.ts";
import {
  InvalidProjectRequestError,
  ProjectNotFoundError,
} from "../services/project.service.ts";
import { Deployment } from "../domain/deployment.ts";

describe("ProjectController", () => {
  test("creates a project", async () => {
    const service = {
      createProject: async (input: { repoUrl: string }) => ({
        id: "project-123",
        slug: "react-app-123abc",
        name: "react-app",
        repoUrl: input.repoUrl,
        defaultBranch: "main",
        rootDirectory: null,
        installCommand: null,
        buildCommand: null,
        outputDirectory: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      }),
    };
    const controller = new ProjectController(service as never);

    const response = await controller.create(
      new Request("http://localhost/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repoUrl: "https://github.com/acme/react-app.git",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "project-123",
      slug: "react-app-123abc",
      name: "react-app",
      repoUrl: "https://github.com/acme/react-app.git",
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: null,
      buildCommand: null,
      outputDirectory: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
  });

  test("validates project creation inputs", async () => {
    const controller = new ProjectController({} as never);

    const response = await controller.create(
      new Request("http://localhost/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repoUrl: 123,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "repoUrl must be a string",
    });
  });

  test("lists projects with pagination", async () => {
    const service = {
      listProjects: async (options: { limit: number; offset: number }) => {
        expect(options).toEqual({ limit: 10, offset: 5 });
        return [];
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.list(
      new Request("http://localhost/projects?limit=10&offset=5"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projects: [] });
  });

  test("returns 404 when a project is not found", async () => {
    const service = {
      getProject: async () => {
        throw new ProjectNotFoundError("project-123");
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.getById("project-123");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Project project-123 not found",
    });
  });

  test("creates a deployment for a project", async () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
    });
    const service = {
      createDeployment: async (projectId: string, gitRef?: string) => {
        expect(projectId).toBe("project-123");
        expect(gitRef).toBe("main");
        return deployment;
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.createDeployment(
      new Request("http://localhost/projects/project-123/deployments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gitRef: "main" }),
      }),
      "project-123",
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(deployment.toJSON());
  });

  test("lists env vars with masked values", async () => {
    const service = {
      listEnvVars: async () => [
        {
          id: "env-123",
          projectId: "project-123",
          key: "API_KEY",
          target: "production",
          maskedValue: "******1234",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    };
    const controller = new ProjectController(service as never);

    const response = await controller.listEnvVars("project-123");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projectId: "project-123",
      envVars: [
        {
          id: "env-123",
          projectId: "project-123",
          key: "API_KEY",
          target: "production",
          maskedValue: "******1234",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  test("returns 400 for invalid env var updates", async () => {
    const controller = new ProjectController({} as never);

    const response = await controller.upsertEnvVar(
      new Request("http://localhost/projects/project-123/env-vars/API_KEY", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: 123 }),
      }),
      "project-123",
      "API_KEY",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "value must be a string",
    });
  });

  test("maps invalid project request errors", async () => {
    const service = {
      createProject: async () => {
        throw new InvalidProjectRequestError("repoUrl is required");
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.create(
      new Request("http://localhost/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: " " }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "repoUrl is required",
    });
  });
});
