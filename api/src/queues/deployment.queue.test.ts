import { describe, expect, mock, test } from "bun:test";
import { DeploymentQueue } from "./deployment.queue.ts";

describe("DeploymentQueue", () => {
  test("pushes serialized deployment jobs to the configured queue", async () => {
    const rpush = mock(async () => 1);
    const queue = new DeploymentQueue({ rpush } as never, "deployment_jobs_test");
    const job = {
      buildJobId: "job-123",
      deploymentId: "deployment-123",
      projectId: "project-123",
      repoUrl: "https://github.com/acme/react-app.git",
      gitRef: "main",
      rootDirectory: null,
      installCommand: null,
      buildCommand: null,
      outputDirectory: null,
    };

    await queue.enqueue(job);

    expect(rpush).toHaveBeenCalledWith(
      "deployment_jobs_test",
      JSON.stringify(job),
    );
  });
});
