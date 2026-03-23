import "./setup.ts";
import { describe, expect, test } from "bun:test";
import type { DeploymentJobMessage } from "../src/contracts/deployment-job.ts";
import {
  DeploymentQueue,
  normalizeDeploymentJobMessage,
} from "../src/infrastructure/redis.ts";

const deploymentJobMessage: DeploymentJobMessage = {
  buildJobId: "build-job-1",
  deploymentId: "deployment-1",
  projectId: "project-1",
  repoUrl: "https://github.com/example/repo.git",
  gitRef: "main",
  rootDirectory: null,
  installCommand: null,
  buildCommand: null,
  outputDirectory: null,
};

describe("DeploymentQueue", () => {
  test("normalizes a string payload", () => {
    expect(normalizeDeploymentJobMessage(JSON.stringify(deploymentJobMessage))).toEqual(
      deploymentJobMessage,
    );
  });

  test("normalizes an already parsed payload", () => {
    expect(normalizeDeploymentJobMessage(deploymentJobMessage)).toEqual(
      deploymentJobMessage,
    );
  });

  test("pop handles object payloads from redis", async () => {
    const queue = new DeploymentQueue(
      {
        async lpop<T>() {
          return deploymentJobMessage as T;
        },
        async rpush() {
          return 1;
        },
      },
      "deployment_jobs_test",
    );

    await expect(queue.pop()).resolves.toEqual(deploymentJobMessage);
  });
});
