import { describe, expect, test } from "bun:test";
import { decryptProjectEnvValue, isEncryptedProjectEnvValue } from "../infrastructure/project-env-crypto.ts";
import type { Project } from "../db/schema.ts";
import {
  InvalidProjectRequestError,
  ProjectNotFoundError,
  ProjectService,
} from "./project.service.ts";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-123",
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

describe("ProjectService", () => {
  test("updates project settings", async () => {
    const updatedProject = createProject({
      defaultBranch: "develop",
      buildCommand: "bun run build",
    });
    const service = new ProjectService(
      {
        findById: async () => createProject(),
        updateSettings: async () => updatedProject,
      } as never,
      {} as never,
      {} as never,
    );

    const project = await service.updateProject("project-123", {
      defaultBranch: "develop",
      buildCommand: "bun run build",
    });

    expect(project.defaultBranch).toBe("develop");
    expect(project.buildCommand).toBe("bun run build");
  });

  test("throws when updating a missing project", async () => {
    const service = new ProjectService(
      {
        findById: async () => null,
      } as never,
      {} as never,
      {} as never,
    );

    await expect(service.updateProject("missing", {})).rejects.toThrow(
      "Project missing not found",
    );
  });

  test("encrypts env vars at rest and masks them on read", async () => {
    const storedValues: string[] = [];
    const service = new ProjectService(
      {
        findById: async () => createProject(),
      } as never,
      {
        upsert: async (values: {
          projectId: string;
          key: string;
          value: string;
          target: "all" | "preview" | "production";
        }) => {
          storedValues.push(values.value);
          return {
            id: "env-123",
            projectId: values.projectId,
            key: values.key,
            value: values.value,
            target: values.target,
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
            updatedAt: new Date("2025-01-01T00:00:00.000Z"),
          };
        },
        listByProjectId: async () => [
          {
            id: "env-123",
            projectId: "project-123",
            key: "API_KEY",
            value: storedValues[0] ?? "",
            target: "preview" as const,
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
            updatedAt: new Date("2025-01-01T00:00:00.000Z"),
          },
        ],
      } as never,
      {} as never,
    );

    const created = await service.upsertEnvVar("project-123", {
      key: "API_KEY",
      value: "secret-value-1234",
      target: "preview",
    });
    const listed = await service.listEnvVars("project-123");

    expect(storedValues).toHaveLength(1);
    expect(isEncryptedProjectEnvValue(storedValues[0]!)).toBe(true);
    expect(await decryptProjectEnvValue(storedValues[0]!)).toBe("secret-value-1234");
    expect(created.maskedValue.endsWith("1234")).toBe(true);
    expect(listed[0]?.maskedValue.endsWith("1234")).toBe(true);
  });

  test("rejects blank env var keys", async () => {
    const service = new ProjectService(
      {
        findById: async () => createProject(),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.upsertEnvVar("project-123", {
        key: "   ",
        value: "secret",
      }),
    ).rejects.toThrow(new InvalidProjectRequestError("key is required"));
  });

  test("passes filters and pagination to deployment listings", async () => {
    const service = new ProjectService(
      {
        findById: async () => createProject(),
      } as never,
      {} as never,
      {
        listDeploymentsByProject: async (
          projectId: string,
          options: {
            limit: number;
            offset: number;
            status?: "ready";
            gitRef?: string;
          },
        ) => {
          expect(projectId).toBe("project-123");
          expect(options).toEqual({
            limit: 10,
            offset: 5,
            status: "ready",
            gitRef: "main",
          });
          return [];
        },
      } as never,
    );

    const deployments = await service.listDeployments("project-123", {
      limit: 10,
      offset: 5,
      status: "ready",
      gitRef: "main",
    });

    expect(deployments).toEqual([]);
  });

  test("creates deployments through the deployment service", async () => {
    const service = new ProjectService(
      {
        findById: async () => createProject(),
      } as never,
      {} as never,
      {
        createDeploymentForProject: async (projectId: string, gitRef?: string) => ({
          projectId,
          gitRef,
        }),
      } as never,
    );

    const result = await service.createDeployment("project-123", "develop");

    expect(result.projectId).toBe("project-123");
    expect(result.gitRef).toBe("develop");
  });

  test("throws when reading a missing project", async () => {
    const service = new ProjectService(
      {
        findById: async () => null,
      } as never,
      {} as never,
      {} as never,
    );

    await expect(service.getProject("missing")).rejects.toThrow(
      new ProjectNotFoundError("missing"),
    );
  });
});
