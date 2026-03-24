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
      createProject: async (clerkUserId: string, input: { repoUrl: string }) => {
        expect(clerkUserId).toBe("user_123");
        return {
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
        };
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.create(
      new Request("http://localhost/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "user_123",
        },
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
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "user_123",
        },
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
      listProjects: async (options: {
        clerkUserId: string;
        limit: number;
        offset: number;
        query?: string;
      }) => {
        expect(options).toEqual({
          clerkUserId: "user_123",
          limit: 11,
          offset: 5,
          query: "react",
        });
        return [
          {
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
          },
        ];
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.list(
      new Request("http://localhost/projects?limit=10&offset=5&query=react", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projects: [
        {
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
        },
      ],
      pageInfo: {
        limit: 10,
        offset: 5,
        hasMore: false,
        nextOffset: null,
      },
    });
  });

  test("returns 404 when a project is not found", async () => {
    const service = {
      getProject: async () => {
        throw new ProjectNotFoundError("project-123");
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.getById(
      new Request("http://localhost/projects/project-123", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
      "project-123",
    );

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
      createDeployment: async (
        clerkUserId: string,
        projectId: string,
        gitRef?: string,
      ) => {
        expect(clerkUserId).toBe("user_123");
        expect(projectId).toBe("project-123");
        expect(gitRef).toBe("main");
        return deployment;
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.createDeployment(
      new Request("http://localhost/projects/project-123/deployments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "user_123",
        },
        body: JSON.stringify({ gitRef: "main" }),
      }),
      "project-123",
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(deployment.toJSON());
  });

  test("updates a project", async () => {
    const service = {
      updateProject: async (
        clerkUserId: string,
        projectId: string,
        input: { defaultBranch?: string },
      ) => {
        expect(clerkUserId).toBe("user_123");
        expect(projectId).toBe("project-123");
        expect(input.defaultBranch).toBe("develop");
        return {
          id: "project-123",
          slug: "react-app-123abc",
          name: "react-app",
          repoUrl: "https://github.com/acme/react-app.git",
          defaultBranch: "develop",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        };
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.update(
      new Request("http://localhost/projects/project-123", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "user_123",
        },
        body: JSON.stringify({ defaultBranch: "develop" }),
      }),
      "project-123",
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { defaultBranch: string };
    expect(json.defaultBranch).toBe("develop");
  });

  test("lists env vars with masked values", async () => {
    const service = {
      listEnvVars: async (clerkUserId: string) => {
        expect(clerkUserId).toBe("user_123");
        return [
          {
            id: "env-123",
            projectId: "project-123",
            key: "API_KEY",
            target: "production",
            maskedValue: "******1234",
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        ];
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.listEnvVars(
      new Request("http://localhost/projects/project-123/env-vars", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
      "project-123",
    );

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
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "user_123",
        },
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

  test("lists deployments with filters and page info", async () => {
    const service = {
      listDeployments: async (
        clerkUserId: string,
        projectId: string,
        options: {
          limit: number;
          offset: number;
          status?: "ready";
          gitRef?: string;
        },
      ) => {
        expect(clerkUserId).toBe("user_123");
        expect(projectId).toBe("project-123");
        expect(options).toEqual({
          limit: 11,
          offset: 0,
          status: "ready",
          gitRef: "main",
        });

        return [
          Deployment.create({
            projectId,
            repoUrl: "https://github.com/acme/react-app.git",
            gitRef: "main",
          }),
        ];
      },
    };
    const controller = new ProjectController(service as never);

    const response = await controller.listDeployments(
      new Request(
        "http://localhost/projects/project-123/deployments?limit=10&status=ready&gitRef=main",
        {
          headers: {
            "x-clerk-user-id": "user_123",
          },
        },
      ),
      "project-123",
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      pageInfo: {
        limit: number;
        offset: number;
        hasMore: boolean;
        nextOffset: number | null;
      };
    };
    expect(json.pageInfo).toEqual({
      limit: 10,
      offset: 0,
      hasMore: false,
      nextOffset: null,
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
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "user_123",
        },
        body: JSON.stringify({ repoUrl: " " }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "repoUrl is required",
    });
  });

  test("returns 401 when the clerk user header is missing", async () => {
    const controller = new ProjectController({} as never);

    const response = await controller.list(
      new Request("http://localhost/projects"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "x-clerk-user-id header is required",
    });
  });
});
