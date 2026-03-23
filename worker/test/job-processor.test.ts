import "./setup.ts";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DeploymentJobMessage } from "../src/contracts/deployment-job.ts";
import type { BuildJob, Deployment, LogStream, Project, ProjectEnvVar } from "../src/db/schema.ts";
import {
  BunCommandRunner,
  CommandExecutionError,
  type CommandRunner,
  type RunCommandOptions,
} from "../src/build/command-runner.ts";
import { JobProcessor } from "../src/services/job-processor.ts";

const testTmpRoot = path.join(process.cwd(), ".tmp");

async function createWorkspace(files: Record<string, string>): Promise<{ repoDir: string; commitSha: string }> {
  await mkdir(testTmpRoot, { recursive: true });
  const repoDir = await mkdtemp(path.join(testTmpRoot, "deploy-grid-worker-repo-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(repoDir, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return {
    repoDir,
    commitSha: `test-commit-${crypto.randomUUID()}`,
  };
}

class InMemoryLogRepository {
  entries: Array<{
    deploymentId: string;
    stream: LogStream;
    sequence: number;
    message: string;
  }> = [];

  async getNextSequence(deploymentId: string): Promise<number> {
    const existing = this.entries
      .filter((entry) => entry.deploymentId === deploymentId)
      .map((entry) => entry.sequence);

    return existing.length === 0 ? 1 : Math.max(...existing) + 1;
  }

  async append(entry: {
    deploymentId: string;
    stream: LogStream;
    sequence: number;
    message: string;
  }): Promise<unknown> {
    this.entries.push(entry);
    return entry;
  }
}

function buildMessage(project: Project, deployment: Deployment, buildJob: BuildJob): DeploymentJobMessage {
  return {
    buildJobId: buildJob.id,
    deploymentId: deployment.id,
    projectId: project.id,
    repoUrl: project.repoUrl,
    gitRef: deployment.gitRef,
    rootDirectory: project.rootDirectory,
    installCommand: project.installCommand,
    buildCommand: project.buildCommand,
    outputDirectory: project.outputDirectory,
  };
}

function createHarness(input: {
  project: Project;
  deployment: Deployment;
  buildJob: BuildJob;
  envVars?: ProjectEnvVar[];
  commandRunner?: CommandRunner;
  checkoutResult?: {
    workspaceDir: string;
    buildDir: string;
    commitSha: string;
  };
  artifactStorage?: {
    uploadObject: (input: { key: string; body: Uint8Array; contentType: string }) => Promise<void>;
    buildArtifactUrl: (deploymentId: string) => string;
  };
}) {
  const logRepository = new InMemoryLogRepository();
  const envVars = input.envVars ?? [];
  const state = {
    project: structuredClone(input.project),
    deployment: structuredClone(input.deployment),
    buildJob: structuredClone(input.buildJob),
  };

  let claimCalls = 0;
  let releaseCalls = 0;

  const buildJobRepository = {
    async findById(id: string) {
      return state.buildJob.id === id ? structuredClone(state.buildJob) : null;
    },
    async claim({
      jobId,
      claimedBy,
      leaseUntil,
      maxAttempts,
      now,
    }: {
      jobId: string;
      claimedBy: string;
      leaseUntil: Date;
      maxAttempts: number;
      now: Date;
    }) {
      claimCalls += 1;

      if (state.buildJob.id !== jobId || state.buildJob.attempts >= maxAttempts) {
        return null;
      }

      if (state.buildJob.status === "running" && state.buildJob.leaseUntil && state.buildJob.leaseUntil > now) {
        return null;
      }

      state.buildJob.status = "running";
      state.buildJob.claimedBy = claimedBy;
      state.buildJob.leaseUntil = leaseUntil;
      state.buildJob.attempts += 1;
      state.buildJob.updatedAt = now;
      state.buildJob.lastError = null;

      return structuredClone(state.buildJob);
    },
    async refreshLease(id: string, claimedBy: string, leaseUntil: Date, now: Date) {
      if (state.buildJob.id !== id || state.buildJob.claimedBy !== claimedBy) {
        return false;
      }

      state.buildJob.leaseUntil = leaseUntil;
      state.buildJob.updatedAt = now;
      return true;
    },
    async releaseClaim(id: string, claimedBy: string, now: Date) {
      releaseCalls += 1;
      if (state.buildJob.id === id && state.buildJob.claimedBy === claimedBy) {
        state.buildJob.leaseUntil = now;
        state.buildJob.updatedAt = now;
      }
    },
  };

  const deploymentRepository = {
    async findById(id: string) {
      return state.deployment.id === id ? structuredClone(state.deployment) : null;
    },
    async updateCommitSha(id: string, commitSha: string, now: Date) {
      if (state.deployment.id === id) {
        state.deployment.commitSha = commitSha;
        state.deployment.updatedAt = now;
      }
    },
  };

  const projectRepository = {
    async findById(id: string) {
      return state.project.id === id ? structuredClone(state.project) : null;
    },
  };

  const projectEnvVarRepository = {
    async listByProjectId() {
      return envVars;
    },
  };

  const workerStateRepository = {
    async markBuilding(_deploymentId: string, now: Date) {
      state.deployment.status = "building";
      state.deployment.buildStartedAt ??= now;
      state.deployment.errorMessage = null;
      state.deployment.updatedAt = now;
    },
    async finalizeSuccess(inputValue: {
      deploymentId: string;
      buildJobId: string;
      claimedBy: string;
      commitSha: string;
      artifactUrl: string;
      now: Date;
    }) {
      expect(inputValue.deploymentId).toBe(state.deployment.id);
      expect(inputValue.buildJobId).toBe(state.buildJob.id);
      expect(inputValue.claimedBy).toBe("test-worker");
      state.deployment.status = "ready";
      state.deployment.commitSha = inputValue.commitSha;
      state.deployment.artifactUrl = inputValue.artifactUrl;
      state.deployment.buildFinishedAt = inputValue.now;
      state.deployment.updatedAt = inputValue.now;
      state.deployment.errorMessage = null;
      state.buildJob.status = "succeeded";
      state.buildJob.leaseUntil = null;
      state.buildJob.lastError = null;
      state.buildJob.updatedAt = inputValue.now;
    },
    async finalizeFailure(inputValue: {
      deploymentId: string;
      buildJobId: string;
      claimedBy: string;
      errorMessage: string;
      now: Date;
    }) {
      expect(inputValue.deploymentId).toBe(state.deployment.id);
      expect(inputValue.buildJobId).toBe(state.buildJob.id);
      expect(inputValue.claimedBy).toBe("test-worker");
      state.deployment.status = "failed";
      state.deployment.errorMessage = inputValue.errorMessage;
      state.deployment.buildFinishedAt = inputValue.now;
      state.deployment.updatedAt = inputValue.now;
      state.buildJob.status = "failed";
      state.buildJob.lastError = inputValue.errorMessage;
      state.buildJob.leaseUntil = null;
      state.buildJob.updatedAt = inputValue.now;
    },
  };

  const artifactStorage =
    input.artifactStorage ??
    ({
      async uploadObject() {},
      buildArtifactUrl(deploymentId: string) {
        return `https://artifacts.example.com/deployments/${deploymentId}/`;
      },
    } satisfies {
      uploadObject: (input: { key: string; body: Uint8Array; contentType: string }) => Promise<void>;
      buildArtifactUrl: (deploymentId: string) => string;
    });

  const processor = new JobProcessor({
    buildJobRepository,
    deploymentRepository,
    projectRepository,
    projectEnvVarRepository,
    deploymentLogRepository: logRepository,
    workerStateRepository,
    artifactStorage,
    commandRunner: input.commandRunner ?? new BunCommandRunner(),
    checkoutRepository: async () => {
      if (!input.checkoutResult) {
        throw new Error("Missing checkoutResult in test harness");
      }

      return input.checkoutResult;
    },
  });

  return {
    processor,
    state,
    logRepository,
    claimCalls: () => claimCalls,
    releaseCalls: () => releaseCalls,
  };
}

const cleanupPaths: string[] = [];

beforeEach(() => {
  cleanupPaths.length = 0;
});

afterEach(async () => {
  await Promise.all(cleanupPaths.map((target) => rm(target, { recursive: true, force: true })));
});

describe("JobProcessor", () => {
  test("skips duplicate delivery for terminal jobs", async () => {
    const project: Project = {
      id: "project-1",
      slug: "demo",
      name: "Demo",
      repoUrl: "https://example.com/demo.git",
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: null,
      buildCommand: null,
      outputDirectory: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const deployment: Deployment = {
      id: "deployment-1",
      projectId: project.id,
      status: "ready",
      gitRef: "main",
      commitSha: null,
      errorMessage: null,
      previewUrl: null,
      artifactUrl: null,
      buildStartedAt: null,
      buildFinishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const buildJob: BuildJob = {
      id: "job-1",
      deploymentId: deployment.id,
      status: "succeeded",
      claimedBy: null,
      leaseUntil: null,
      attempts: 1,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const harness = createHarness({ project, deployment, buildJob });

    await harness.processor.process(buildMessage(project, deployment, buildJob));

    expect(harness.claimCalls()).toBe(0);
    expect(harness.logRepository.entries).toHaveLength(0);
  });

  test("processes a successful build and upload", async () => {
    const repo = await createWorkspace({
      "README.md": "# test\n",
    });
    cleanupPaths.push(repo.repoDir);

    const project: Project = {
      id: "project-2",
      slug: "demo-success",
      name: "Demo Success",
      repoUrl: repo.repoDir,
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: "mkdir -p dist && printf '<html>ok</html>' > dist/index.html",
      buildCommand: "printf 'build complete'",
      outputDirectory: "dist",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const deployment: Deployment = {
      id: "deployment-2",
      projectId: project.id,
      status: "queued",
      gitRef: repo.commitSha,
      commitSha: null,
      errorMessage: null,
      previewUrl: "https://preview.example.com/deployment-2",
      artifactUrl: null,
      buildStartedAt: null,
      buildFinishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const buildJob: BuildJob = {
      id: "job-2",
      deploymentId: deployment.id,
      status: "queued",
      claimedBy: null,
      leaseUntil: null,
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const uploadedKeys: string[] = [];
    const harness = createHarness({
      project,
      deployment,
      buildJob,
      checkoutResult: {
        workspaceDir: repo.repoDir,
        buildDir: repo.repoDir,
        commitSha: repo.commitSha,
      },
      artifactStorage: {
        async uploadObject(input) {
          uploadedKeys.push(input.key);
        },
        buildArtifactUrl(deploymentId) {
          return `https://artifacts.example.com/deployments/${deploymentId}/`;
        },
      },
    });

    await harness.processor.process(buildMessage(project, deployment, buildJob));

    expect(harness.state.deployment.status).toBe("ready");
    expect(harness.state.buildJob.status).toBe("succeeded");
    expect(harness.state.deployment.commitSha).toBe(repo.commitSha);
    expect(harness.state.deployment.artifactUrl).toBe(
      "https://artifacts.example.com/deployments/deployment-2/",
    );
    expect(uploadedKeys).toEqual(["deployments/deployment-2/index.html"]);
    expect(harness.logRepository.entries.map((entry) => entry.message)).toContain(
      "deployment marked ready",
    );
  });

  test("marks the deployment failed when the build command fails", async () => {
    const repo = await createWorkspace({
      "README.md": "# test\n",
    });
    cleanupPaths.push(repo.repoDir);

    const project: Project = {
      id: "project-3",
      slug: "demo-failure",
      name: "Demo Failure",
      repoUrl: repo.repoDir,
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: "true",
      buildCommand: "exit 1",
      outputDirectory: "dist",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const deployment: Deployment = {
      id: "deployment-3",
      projectId: project.id,
      status: "queued",
      gitRef: repo.commitSha,
      commitSha: null,
      errorMessage: null,
      previewUrl: null,
      artifactUrl: null,
      buildStartedAt: null,
      buildFinishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const buildJob: BuildJob = {
      id: "job-3",
      deploymentId: deployment.id,
      status: "queued",
      claimedBy: null,
      leaseUntil: null,
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const harness = createHarness({
      project,
      deployment,
      buildJob,
      checkoutResult: {
        workspaceDir: repo.repoDir,
        buildDir: repo.repoDir,
        commitSha: repo.commitSha,
      },
    });

    await expect(harness.processor.process(buildMessage(project, deployment, buildJob))).rejects.toThrow(
      "Command failed with exit code 1",
    );

    expect(harness.state.deployment.status).toBe("failed");
    expect(harness.state.buildJob.status).toBe("failed");
    expect(harness.state.buildJob.lastError).toContain("Command failed");
  });

  test("fails the deployment when artifact upload fails", async () => {
    const repo = await createWorkspace({
      "README.md": "# test\n",
    });
    cleanupPaths.push(repo.repoDir);

    const project: Project = {
      id: "project-4",
      slug: "demo-upload-failure",
      name: "Demo Upload Failure",
      repoUrl: repo.repoDir,
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: "mkdir -p dist && printf '<html>ok</html>' > dist/index.html",
      buildCommand: "true",
      outputDirectory: "dist",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const deployment: Deployment = {
      id: "deployment-4",
      projectId: project.id,
      status: "queued",
      gitRef: repo.commitSha,
      commitSha: null,
      errorMessage: null,
      previewUrl: null,
      artifactUrl: null,
      buildStartedAt: null,
      buildFinishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const buildJob: BuildJob = {
      id: "job-4",
      deploymentId: deployment.id,
      status: "queued",
      claimedBy: null,
      leaseUntil: null,
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const harness = createHarness({
      project,
      deployment,
      buildJob,
      checkoutResult: {
        workspaceDir: repo.repoDir,
        buildDir: repo.repoDir,
        commitSha: repo.commitSha,
      },
      artifactStorage: {
        async uploadObject() {
          throw new Error("upload failed");
        },
        buildArtifactUrl(deploymentId) {
          return `https://artifacts.example.com/deployments/${deploymentId}/`;
        },
      },
    });

    await expect(harness.processor.process(buildMessage(project, deployment, buildJob))).rejects.toThrow(
      "upload failed",
    );

    expect(harness.state.deployment.status).toBe("failed");
    expect(harness.state.buildJob.status).toBe("failed");
    expect(harness.state.deployment.artifactUrl).toBeNull();
  });

  test("retries a transient build failure and still succeeds", async () => {
    const repo = await createWorkspace({
      "README.md": "# test\n",
    });
    cleanupPaths.push(repo.repoDir);

    const project: Project = {
      id: "project-5",
      slug: "demo-retry",
      name: "Demo Retry",
      repoUrl: repo.repoDir,
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: "mkdir -p dist && printf '<html>ok</html>' > dist/index.html",
      buildCommand: "printf 'build complete'",
      outputDirectory: "dist",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const deployment: Deployment = {
      id: "deployment-5",
      projectId: project.id,
      status: "queued",
      gitRef: repo.commitSha,
      commitSha: null,
      errorMessage: null,
      previewUrl: null,
      artifactUrl: null,
      buildStartedAt: null,
      buildFinishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const buildJob: BuildJob = {
      id: "job-5",
      deploymentId: deployment.id,
      status: "queued",
      claimedBy: null,
      leaseUntil: null,
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let buildAttempts = 0;
    const commandRunner: CommandRunner = {
      async run(options: RunCommandOptions) {
        if (options.command === project.buildCommand) {
          buildAttempts += 1;

          if (buildAttempts === 1) {
            throw new CommandExecutionError(
              options.command,
              1,
              "ECONNRESET while downloading build dependency",
            );
          }
        }

        return new BunCommandRunner().run(options);
      },
    };

    const harness = createHarness({
      project,
      deployment,
      buildJob,
      commandRunner,
      checkoutResult: {
        workspaceDir: repo.repoDir,
        buildDir: repo.repoDir,
        commitSha: repo.commitSha,
      },
    });

    await harness.processor.process(buildMessage(project, deployment, buildJob));

    expect(buildAttempts).toBe(2);
    expect(harness.state.deployment.status).toBe("ready");
    expect(harness.logRepository.entries.map((entry) => entry.message)).toContain(
      "build retry 2/2 after transient failure: Command failed with exit code 1: printf 'build complete' ECONNRESET while downloading build dependency",
    );
  });
});
