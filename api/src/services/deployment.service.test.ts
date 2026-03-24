import { describe, expect, mock, test } from "bun:test";
import type { Project } from "../db/schema.ts";
import { DeploymentService } from "./deployment.service.ts";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-123",
    clerkUserId: "user_123",
    slug: "react-app-123abc",
    name: "react-app",
    repoUrl: "https://github.com/acme/react-app.git",
    defaultBranch: "main",
    rootDirectory: null,
    installCommand: null,
    buildCommand: null,
    outputDirectory: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("DeploymentService", () => {
  test("rejects blank repo URLs", async () => {
    const service = new DeploymentService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.createDeployment("user_123", "   ")).rejects.toThrow(
      "repoUrl is required",
    );
  });

  test("reuses an existing project and defaults gitRef to the default branch", async () => {
    const project = createProject({
      defaultBranch: "develop",
      rootDirectory: "apps/web",
      installCommand: "bun install",
      buildCommand: "bun run build",
      outputDirectory: "dist",
    });
    const createOrGet = mock(
      async (_values: { slug: string; name: string; repoUrl: string }) =>
        project,
    );
    const findByRepoUrl = mock(
      async (_repoUrl: string, clerkUserId?: string) => {
        expect(clerkUserId).toBe("user_123");
        return project;
      },
    );
    const createDeployment = mock(async (_deployment: unknown) => {});
    const createBuildJob = mock(async (_deploymentId: string) => ({
      id: "job-123",
    }));
    const enqueue = mock(async (_job: unknown) => {});
    const service = new DeploymentService(
      {
        create: createDeployment,
        findById: async () => null,
        update: async () => {},
      } as never,
      {
        findByRepoUrl,
        createOrGet,
      } as never,
      {
        create: createBuildJob,
        markFailed: async () => {},
      } as never,
      {} as never,
      { enqueue } as never,
    );

    const deployment = await service.createDeployment("user_123", project.repoUrl);

    expect(findByRepoUrl).toHaveBeenCalledWith(project.repoUrl, "user_123");
    expect(createOrGet).not.toHaveBeenCalled();
    expect(createDeployment).toHaveBeenCalledTimes(1);
    expect(createBuildJob).toHaveBeenCalledWith(deployment.id);
    expect(deployment.projectId).toBe(project.id);
    expect(deployment.gitRef).toBe("develop");
    expect(enqueue).toHaveBeenCalledWith({
      buildJobId: "job-123",
      deploymentId: deployment.id,
      projectId: project.id,
      repoUrl: project.repoUrl,
      gitRef: "develop",
      rootDirectory: "apps/web",
      installCommand: "bun install",
      buildCommand: "bun run build",
      outputDirectory: "dist",
    });
  });

  test("creates a project when one does not already exist", async () => {
    const project = createProject();
    const createOrGet = mock(
      async (_values: { slug: string; name: string; repoUrl: string }) =>
        project,
    );
    const findByRepoUrl = mock(
      async (_repoUrl: string, clerkUserId?: string) => {
        expect(clerkUserId).toBe("user_123");
        return null;
      },
    );
    const createDeployment = mock(async (_deployment: unknown) => {});
    const createBuildJob = mock(async (_deploymentId: string) => ({
      id: "job-123",
    }));
    const enqueue = mock(async (_job: unknown) => {});
    const service = new DeploymentService(
      {
        create: createDeployment,
        findById: async () => null,
        update: async () => {},
      } as never,
      {
        findByRepoUrl,
        createOrGet,
      } as never,
      {
        create: createBuildJob,
        markFailed: async () => {},
      } as never,
      {} as never,
      { enqueue } as never,
    );

    await service.createDeployment("user_123", project.repoUrl);

    expect(findByRepoUrl).toHaveBeenCalledWith(project.repoUrl, "user_123");
    expect(createOrGet).toHaveBeenCalledTimes(1);
    expect(createOrGet.mock.calls[0]?.[0]).toMatchObject({
      clerkUserId: "user_123",
      name: "react-app",
      repoUrl: project.repoUrl,
    });
  });

  test("uses an explicit trimmed gitRef when provided", async () => {
    const project = createProject({
      defaultBranch: "main",
    });
    const enqueue = mock(async () => {});
    const service = new DeploymentService(
      {
        create: async () => {},
        findById: async () => null,
        update: async () => {},
      } as never,
      {
        findByRepoUrl: async () => project,
        createOrGet: async () => project,
      } as never,
      {
        create: async () => ({ id: "job-123" }),
        markFailed: async () => {},
      } as never,
      {} as never,
      { enqueue } as never,
    );

    const deployment = await service.createDeployment(
      "user_123",
      project.repoUrl,
      " release ",
    );

    expect(deployment.gitRef).toBe("release");
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        gitRef: "release",
      }),
    );
  });

  test("marks the deployment and build job as failed if enqueueing fails", async () => {
    const project = createProject();
    const createDeployment = mock(async () => {});
    const updateDeployment = mock(async () => {});
    const markFailed = mock(async () => {});
    const service = new DeploymentService(
      {
        create: createDeployment,
        findById: async () => null,
        update: updateDeployment,
      } as never,
      {
        findByRepoUrl: async () => project,
        createOrGet: async () => project,
      } as never,
      {
        create: async () => ({ id: "job-123" }),
        markFailed,
      } as never,
      {} as never,
      {
        enqueue: async () => {
          throw new Error("queue offline");
        },
      } as never,
    );

    const deployment = await service.createDeployment("user_123", project.repoUrl);

    expect(createDeployment).toHaveBeenCalledTimes(1);
    expect(updateDeployment).toHaveBeenCalledTimes(1);
    expect(deployment.status).toBe("failed");
    expect(deployment.errorMessage).toBe("queue offline");
    expect(markFailed).toHaveBeenCalledWith("job-123", "queue offline");
  });

  test("returns an existing deployment by id", async () => {
    const project = createProject();
    const createdDeployment = await new DeploymentService(
      {
        create: async () => {},
        findById: async () => null,
        update: async () => {},
      } as never,
      {
        findByRepoUrl: async () => project,
        createOrGet: async () => project,
      } as never,
      {
        create: async () => ({ id: "job-123" }),
        markFailed: async () => {},
      } as never,
      {} as never,
      { enqueue: async () => {} } as never,
    ).createDeployment("user_123", project.repoUrl);

    const service = new DeploymentService(
      {
        create: async () => {},
        findById: async (id: string) =>
          id === createdDeployment.id ? createdDeployment : null,
        update: async () => {},
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getDeployment(createdDeployment.id, "user_123")).resolves.toBe(
      createdDeployment,
    );
  });

  test("throws a not found error when the deployment does not exist", async () => {
    const service = new DeploymentService(
      {
        create: async () => {},
        findById: async () => null,
        update: async () => {},
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getDeployment("missing-id", "user_123")).rejects.toThrow(
      "Deployment missing-id not found",
    );
  });

  test("treats deployments from another user as not found", async () => {
    const service = new DeploymentService(
      {
        create: async () => {},
        findById: async (_id: string, clerkUserId?: string) => {
          expect(clerkUserId).toBe("user_456");
          return null;
        },
        update: async () => {},
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getDeployment("deployment-123", "user_456")).rejects.toThrow(
      "Deployment deployment-123 not found",
    );
  });
});
