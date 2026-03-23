import { describe, expect, test } from "bun:test";
import { Deployment } from "./deployment.ts";
import type { DeploymentSnapshot } from "./deployment.types.ts";

describe("Deployment", () => {
  test("creates a queued deployment snapshot", () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
    });

    expect(typeof deployment.id).toBe("string");
    expect(deployment.projectId).toBe("project-123");
    expect(deployment.repoUrl).toBe("https://github.com/acme/react-app.git");
    expect(deployment.gitRef).toBe("main");
    expect(deployment.status).toBe("queued");
    expect(deployment.commitSha).toBeNull();
    expect(deployment.previewUrl).toBeNull();
    expect(deployment.artifactUrl).toBeNull();
    expect(deployment.buildStartedAt).toBeNull();
    expect(deployment.buildFinishedAt).toBeNull();
    expect(deployment.errorMessage).toBeNull();
    expect(typeof deployment.createdAt).toBe("string");
    expect(deployment.updatedAt).toBe(deployment.createdAt);
  });

  test("hydrates from an existing snapshot", () => {
    const snapshot: DeploymentSnapshot = {
      id: "deployment-123",
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "develop",
      status: "building",
      commitSha: "abc123",
      previewUrl: "https://preview.example.com",
      artifactUrl: "https://artifact.example.com",
      buildStartedAt: "2025-01-01T00:00:01.000Z",
      buildFinishedAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:02.000Z",
      errorMessage: null,
    };

    const deployment = Deployment.hydrate(snapshot);

    expect(deployment.toJSON()).toEqual(snapshot);
  });

  test("marks a deployment as building", () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
    });

    deployment.markFailed("Previous error");
    deployment.startBuild();

    expect(deployment.status).toBe("building");
    expect(deployment.errorMessage).toBeNull();
    expect(typeof deployment.buildStartedAt).toBe("string");
    expect(typeof deployment.updatedAt).toBe("string");
  });

  test("marks a deployment as ready", () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
    });

    deployment.startBuild();
    deployment.markSuccess();

    expect(deployment.status).toBe("ready");
    expect(deployment.errorMessage).toBeNull();
    expect(typeof deployment.buildFinishedAt).toBe("string");
  });

  test("marks a deployment as failed with a custom message", () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
    });

    deployment.markFailed("Queue unavailable");

    expect(deployment.status).toBe("failed");
    expect(deployment.errorMessage).toBe("Queue unavailable");
    expect(typeof deployment.buildFinishedAt).toBe("string");
  });

  test("marks a deployment as failed with the default message", () => {
    const deployment = Deployment.create({
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
    });

    deployment.markFailed();

    expect(deployment.status).toBe("failed");
    expect(deployment.errorMessage).toBe("Build failed");
  });
});
