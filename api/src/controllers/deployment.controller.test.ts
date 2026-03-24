import { describe, expect, test } from "bun:test";
import { Deployment } from "../domain/deployment.ts";
import { DeploymentController } from "./deployment.controller.ts";
import {
  DeploymentNotFoundError,
  InvalidDeploymentRequestError,
} from "../services/deployment.service.ts";

describe("DeploymentController", () => {
  test("returns 400 when repoUrl is missing", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
    };
    const controller = new DeploymentController(service as never);
    const request = new Request("http://localhost/deployments", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "content-type": "application/json",
        "x-clerk-user-id": "user_123",
      },
    });

    const response = await controller.create(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "repoUrl must be a string",
    });
  });

  test("returns 400 when gitRef is not a string", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
    };
    const controller = new DeploymentController(service as never);
    const request = new Request("http://localhost/deployments", {
      method: "POST",
      body: JSON.stringify({
        repoUrl: "https://github.com/acme/react-app.git",
        gitRef: 123,
      }),
      headers: {
        "content-type": "application/json",
        "x-clerk-user-id": "user_123",
      },
    });

    const response = await controller.create(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "gitRef must be a string",
    });
  });

  test("returns 400 for invalid JSON", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
    };
    const controller = new DeploymentController(service as never);
    const request = new Request("http://localhost/deployments", {
      method: "POST",
      body: "{bad json",
      headers: {
        "content-type": "application/json",
        "x-clerk-user-id": "user_123",
      },
    });

    const response = await controller.create(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid request body",
    });
  });

  test("returns 400 for invalid deployment request errors", async () => {
    const service = {
      createDeployment: async () => {
        throw new InvalidDeploymentRequestError("repoUrl is required");
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
    };
    const controller = new DeploymentController(service as never);
    const request = new Request("http://localhost/deployments", {
      method: "POST",
      body: JSON.stringify({
        repoUrl: "   ",
      }),
      headers: {
        "content-type": "application/json",
        "x-clerk-user-id": "user_123",
      },
    });

    const response = await controller.create(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "repoUrl is required",
    });
  });

  test("returns 202 with the deployment snapshot on success", async () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
    });
    const service = {
      createDeployment: async (
        clerkUserId: string,
        repoUrl: string,
        gitRef?: string,
      ) => {
        expect(clerkUserId).toBe("user_123");
        expect(repoUrl).toBe("https://github.com/acme/react-app.git");
        expect(gitRef).toBe("main");
        return deployment;
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
    };
    const controller = new DeploymentController(service as never);
    const request = new Request("http://localhost/deployments", {
      method: "POST",
      body: JSON.stringify({
        repoUrl: "https://github.com/acme/react-app.git",
        gitRef: "main",
      }),
      headers: {
        "content-type": "application/json",
        "x-clerk-user-id": "user_123",
      },
    });

    const response = await controller.create(request);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(deployment.toJSON());
  });

  test("returns 500 when createDeployment throws an unexpected error", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("database unavailable");
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
    };
    const controller = new DeploymentController(service as never);
    const request = new Request("http://localhost/deployments", {
      method: "POST",
      body: JSON.stringify({
        repoUrl: "https://github.com/acme/react-app.git",
      }),
      headers: {
        "content-type": "application/json",
        "x-clerk-user-id": "user_123",
      },
    });

    const response = await controller.create(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "database unavailable",
    });
  });

  test("returns 404 when a deployment is not found", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeployment: async () => {
        throw new DeploymentNotFoundError("missing-id");
      },
    };
    const controller = new DeploymentController(service as never);

    const response = await controller.getById(
      new Request("http://localhost/deployments/missing-id", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
      "missing-id",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Deployment missing-id not found",
    });
  });

  test("returns 500 when getById throws an unexpected error", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeployment: async () => {
        throw new Error("database unavailable");
      },
    };
    const controller = new DeploymentController(service as never);

    const response = await controller.getById(
      new Request("http://localhost/deployments/deployment-123", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
      "deployment-123",
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "database unavailable",
    });
  });

  test("returns deployment logs", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeploymentLogs: async (
        _id: string,
        clerkUserId: string,
        options: { limit: number },
      ) => {
        expect(clerkUserId).toBe("user_123");
        expect(options.limit).toBe(10);
        return [
          {
            id: "log-123",
            deploymentId: "deployment-123",
            stream: "stdout",
            sequence: 1,
            message: "building...",
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
          },
        ];
      },
    };
    const controller = new DeploymentController(service as never);

    const response = await controller.getLogs(
      new Request("http://localhost/deployments/deployment-123/logs?limit=10", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
      "deployment-123",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deploymentId: "deployment-123",
      logs: [
        {
          id: "log-123",
          deploymentId: "deployment-123",
          stream: "stdout",
          sequence: 1,
          message: "building...",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  test("validates deployment log query params", async () => {
    const service = {
      createDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeployment: async () => {
        throw new Error("should not be called");
      },
      getDeploymentLogs: async () => {
        throw new Error("should not be called");
      },
    };
    const controller = new DeploymentController(service as never);

    const response = await controller.getLogs(
      new Request("http://localhost/deployments/deployment-123/logs?limit=0", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
      "deployment-123",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "limit must be a positive number",
    });
  });

  test("re-deploys an existing deployment", async () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "release",
    });
    const service = {
      redeployDeployment: async (
        id: string,
        clerkUserId: string,
        gitRef?: string,
      ) => {
        expect(id).toBe("deployment-123");
        expect(clerkUserId).toBe("user_123");
        expect(gitRef).toBe("release");
        return deployment;
      },
    };
    const controller = new DeploymentController(service as never);

    const response = await controller.redeploy(
      new Request("http://localhost/deployments/deployment-123/redeploy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clerk-user-id": "user_123",
        },
        body: JSON.stringify({ gitRef: "release" }),
      }),
      "deployment-123",
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(deployment.toJSON());
  });

  test("returns 401 when the clerk user header is missing", async () => {
    const controller = new DeploymentController({} as never);

    const response = await controller.getById(
      new Request("http://localhost/deployments/deployment-123"),
      "deployment-123",
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "x-clerk-user-id header is required",
    });
  });
});
