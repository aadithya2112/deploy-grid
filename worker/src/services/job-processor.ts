import path from "node:path";
import { installationToken } from "../../../shared/github.ts";
import { detectFramework } from "../build/framework.ts";
import { env } from "../config/env.ts";
import type { DeploymentJobMessage } from "../contracts/deployment-job.ts";
import type { BuildJob, Deployment, Project, ProjectEnvVar } from "../db/schema.ts";
import { cleanupDirectory } from "../build/fs.ts";
import type { CommandRunner } from "../build/command-runner.ts";
import { resolveBuildCommands } from "../build/command-resolution.ts";
import { resolveArtifactDirectory } from "../build/artifact-detection.ts";
import {
  checkoutRepository,
  type CheckoutRepositoryInput,
  type CheckoutRepositoryResult,
} from "../build/repository-checkout.ts";
import { runCommandWithRetry } from "../build/retry.ts";
import type { ArtifactStorageLike } from "../infrastructure/r2.ts";
import { logger } from "../infrastructure/logger.ts";
import { BuildJobRepository } from "../repositories/build-job.repository.ts";
import { DeploymentRepository } from "../repositories/deployment.repository.ts";
import { ProjectEnvVarRepository } from "../repositories/project-env-var.repository.ts";
import { ProjectRepository } from "../repositories/project.repository.ts";
import { uploadArtifactDirectory } from "./artifact-upload.ts";
import {
  DeploymentLogWriter,
  type DeploymentLogRepositoryLike,
} from "./deployment-log-writer.ts";
import { resolveBuildEnvironment } from "./env-resolution.ts";

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown worker error";
  return message.replace(/\s+/g, " ").trim().slice(0, 1_000);
}

interface ProcessorDependencies {
  buildJobRepository: Pick<
    BuildJobRepository,
    "findById" | "claim" | "refreshLease" | "releaseClaim"
  >;
  deploymentRepository: Pick<DeploymentRepository, "findById" | "updateCommitSha">;
  projectRepository: Pick<ProjectRepository, "findById">;
  projectEnvVarRepository: Pick<ProjectEnvVarRepository, "listByProjectId">;
  deploymentLogRepository: DeploymentLogRepositoryLike;
  workerStateRepository: {
    markBuilding(deploymentId: string, now: Date): Promise<void>;
    finalizeSuccess(input: {
      deploymentId: string;
      buildJobId: string;
      claimedBy: string;
      commitSha: string;
      artifactUrl: string;
      now: Date;
      artifactPrefix?: string;
      framework?: string;
      routing?: "spa" | "static";
      metrics?: Record<string, number>;
    }): Promise<void>;
    finalizeFailure(input: {
      deploymentId: string;
      buildJobId: string;
      claimedBy: string;
      errorMessage: string;
      now: Date;
    }): Promise<void>;
  };
  artifactStorage: ArtifactStorageLike;
  commandRunner: CommandRunner;
  checkoutRepository: (
    input: CheckoutRepositoryInput,
  ) => Promise<CheckoutRepositoryResult>;
  now?: () => Date;
  onStatus?: (deploymentId: string, status: "pending" | "success" | "failure") => Promise<void>;
}

function getResolvedProjectSetting(
  projectValue: string | null,
  payloadValue: string | null,
): string | null {
  return projectValue?.trim() || payloadValue?.trim() || null;
}

function shouldSkipProcessing(
  buildJob: BuildJob,
  deployment: Deployment,
  workerId: string,
  now: Date,
): boolean {
  if (buildJob.status === "succeeded" || buildJob.status === "failed") {
    return true;
  }

  if (
    deployment.status === "ready" ||
    deployment.status === "failed" ||
    deployment.status === "cancelled"
  ) {
    return true;
  }

  if (
    buildJob.status === "running" &&
    buildJob.claimedBy &&
    buildJob.claimedBy !== workerId &&
    buildJob.leaseUntil &&
    buildJob.leaseUntil > now
  ) {
    return true;
  }

  return false;
}

async function loadRequiredState(
  dependencies: ProcessorDependencies,
  message: DeploymentJobMessage,
): Promise<{
  buildJob: BuildJob;
  deployment: Deployment;
  project: Project;
  projectEnvVars: ProjectEnvVar[];
} | null> {
  const [buildJob, deployment, project, projectEnvVars] = await Promise.all([
    dependencies.buildJobRepository.findById(message.buildJobId),
    dependencies.deploymentRepository.findById(message.deploymentId),
    dependencies.projectRepository.findById(message.projectId),
    dependencies.projectEnvVarRepository.listByProjectId(message.projectId),
  ]);

  if (!buildJob || !deployment || !project) {
    logger.warn("Skipping job with missing database rows", {
      buildJobId: message.buildJobId,
      deploymentId: message.deploymentId,
      projectId: message.projectId,
    });
    return null;
  }

  return { buildJob, deployment, project, projectEnvVars };
}

export class JobProcessor {
  constructor(private readonly dependencies: ProcessorDependencies) {}

  async process(message: DeploymentJobMessage): Promise<void> {
    const now = this.dependencies.now?.() ?? new Date();
    const state = await loadRequiredState(this.dependencies, message);

    if (!state) {
      return;
    }

    if (shouldSkipProcessing(state.buildJob, state.deployment, env.workerId, now)) {
      logger.info("Skipping non-actionable deployment job", {
        buildJobId: state.buildJob.id,
        deploymentId: state.deployment.id,
        status: state.buildJob.status,
        deploymentStatus: state.deployment.status,
      });
      return;
    }

    const leaseUntil = new Date(now.getTime() + env.buildJobLeaseSeconds * 1_000);
    const claimedJob = await this.dependencies.buildJobRepository.claim({
      jobId: state.buildJob.id,
      claimedBy: env.workerId,
      leaseUntil,
      maxAttempts: env.maxBuildAttempts,
      now,
    });

    if (!claimedJob) {
      logger.info("Build job claim was rejected", {
        buildJobId: state.buildJob.id,
        deploymentId: state.deployment.id,
      });
      return;
    }

    const logWriter = new DeploymentLogWriter(
      this.dependencies.deploymentLogRepository,
      state.deployment.id,
    );

    const cancellation = new AbortController();
    const started = performance.now();
    const metrics: Record<string, number> = {};
    const artifactId = `${state.deployment.id}/${crypto.randomUUID()}`;
    let secrets: string[] = [];
    let workspaceDir: string | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let claimReleased = false;

    try {
      await this.dependencies.workerStateRepository.markBuilding(state.deployment.id, now);
      await logWriter.system(`job claimed by ${env.workerId}`);
      await logWriter.system("build started");

      heartbeat = setInterval(() => {
        const heartbeatNow = this.dependencies.now?.() ?? new Date();
        const nextLeaseUntil = new Date(
          heartbeatNow.getTime() + env.buildJobLeaseSeconds * 1_000,
        );

        void this.dependencies.buildJobRepository
          .refreshLease(claimedJob.id, env.workerId, nextLeaseUntil, heartbeatNow)
          .then((refreshed) => {
            if (!refreshed) {
              cancellation.abort();
              logger.warn("Failed to refresh build job lease", {
                buildJobId: claimedJob.id,
                deploymentId: state.deployment.id,
              });
            }
          })
          .catch((error) => {
            cancellation.abort();
            logger.warn("Lease refresh errored", {
              buildJobId: claimedJob.id,
              deploymentId: state.deployment.id,
              error: sanitizeErrorMessage(error),
            });
          });
      }, env.heartbeatIntervalSeconds * 1_000);

      await logWriter.system("clone started");

      const settings = state.deployment.settings ?? state.project;
      const gitToken = state.deployment.githubInstallationId ? await installationToken(state.deployment.githubInstallationId) : undefined;
      if (gitToken) logWriter.setSecretsToRedact([gitToken]);
      const checkout = await this.dependencies.checkoutRepository({
        gitToken,
        deploymentId: state.deployment.id,
        repoUrl: state.project.repoUrl || message.repoUrl,
        gitRef: state.deployment.gitRef || message.gitRef,
        tmpBaseDir: env.workerTmpDir,
        rootDirectory: getResolvedProjectSetting(
          settings.rootDirectory,
          message.rootDirectory,
        ),
        commandRunner: this.dependencies.commandRunner,
        onStdout: (line) => logWriter.stdout(line),
        onStderr: (line) => logWriter.stderr(line),
      });

      workspaceDir = checkout.workspaceDir;

      await this.dependencies.deploymentRepository.updateCommitSha(
        state.deployment.id,
        checkout.commitSha,
        this.dependencies.now?.() ?? new Date(),
      );

      await this.dependencies.onStatus?.(state.deployment.id, "pending");
      await logWriter.system("clone completed");
      await logWriter.system(`resolved commit ${checkout.commitSha}`);

      metrics.cloneMs = performance.now() - started;
      const buildEnv = await resolveBuildEnvironment(state.projectEnvVars, state.deployment.environment ?? "preview");
      const redactionValues = Object.values(buildEnv).filter(Boolean);
      secrets = redactionValues;
      logWriter.setSecretsToRedact(redactionValues);

      const framework = await detectFramework(checkout.buildDir);
      await logWriter.system(`framework=${framework.framework} routing=${framework.routing}`);
      const buildCommands = await resolveBuildCommands(checkout.buildDir, {
        installCommand: getResolvedProjectSetting(
          settings.installCommand,
          message.installCommand,
        ),
        buildCommand: getResolvedProjectSetting(
          settings.buildCommand,
          message.buildCommand,
        ),
        outputDirectory: getResolvedProjectSetting(
          settings.outputDirectory,
          message.outputDirectory,
        ),
      });

      await logWriter.system(
        `selected package manager=${buildCommands.packageManager} install=${buildCommands.installCommand}`,
      );
      await logWriter.system(`selected build command=${buildCommands.buildCommand}`);
      await logWriter.system("dependencies install started");
      const installStarted = performance.now();

      await runCommandWithRetry(this.dependencies.commandRunner, {
        command: buildCommands.installCommand,
        cwd: checkout.buildDir,
        env: buildEnv,
        workspaceDir: checkout.workspaceDir,
        signal: cancellation.signal,
        cacheKey: state.project.id,
        timeoutMs: env.buildTimeoutSeconds * 1_000,
        retryLimit: env.transientCommandRetryLimit,
        retryDelayMs: env.transientCommandRetryDelayMs,
        onRetry: (attempt, error) =>
          logWriter.system(
            `dependencies install retry ${attempt}/${env.transientCommandRetryLimit} after transient failure: ${sanitizeErrorMessage(error)}`,
          ),
        onStdout: (line) => logWriter.stdout(line),
        onStderr: (line) => logWriter.stderr(line),
      });

      metrics.installMs = performance.now() - installStarted;
      await logWriter.system("dependencies install completed");
      const buildStarted = performance.now();
      await logWriter.system("build started");

      await runCommandWithRetry(this.dependencies.commandRunner, {
        command: buildCommands.buildCommand,
        cwd: checkout.buildDir,
        env: buildEnv,
        workspaceDir: checkout.workspaceDir,
        signal: cancellation.signal,
        cacheKey: state.project.id,
        timeoutMs: env.buildTimeoutSeconds * 1_000,
        retryLimit: env.transientCommandRetryLimit,
        retryDelayMs: env.transientCommandRetryDelayMs,
        onRetry: (attempt, error) =>
          logWriter.system(
            `build retry ${attempt}/${env.transientCommandRetryLimit} after transient failure: ${sanitizeErrorMessage(error)}`,
          ),
        onStdout: (line) => logWriter.stdout(line),
        onStderr: (line) => logWriter.stderr(line),
      });

      metrics.buildMs = performance.now() - buildStarted;
      await logWriter.system("build completed");

      const artifactDirectory = await resolveArtifactDirectory(
        checkout.buildDir,
        buildCommands.outputDirectory ?? (framework.framework === "static" ? null : framework.outputDirectory),
      );

      await logWriter.system(`artifact upload started from ${path.basename(artifactDirectory)}`);

      const artifactUrl = await uploadArtifactDirectory(
        this.dependencies.artifactStorage,
        artifactId,
        artifactDirectory,
        framework,
      );

      await logWriter.system("artifact upload completed");

      const finishedAt = this.dependencies.now?.() ?? new Date();
      await this.dependencies.workerStateRepository.finalizeSuccess({
        deploymentId: state.deployment.id,
        buildJobId: claimedJob.id,
        claimedBy: env.workerId,
        commitSha: checkout.commitSha,
        artifactUrl: state.deployment.previewUrl ?? artifactUrl,
        artifactPrefix: `deployments/${artifactId}`,
        framework: framework.framework,
        routing: framework.routing,
        metrics: { ...metrics, totalMs: performance.now() - started },
        now: finishedAt,
      });

      await this.dependencies.onStatus?.(state.deployment.id, "success");
      await logWriter.system("deployment marked ready");
      claimReleased = true;
    } catch (error: unknown) {
      let errorMessage = sanitizeErrorMessage(error);
      for (const secret of secrets) errorMessage = errorMessage.split(secret).join("[REDACTED]");

      await this.dependencies.workerStateRepository.finalizeFailure({
        deploymentId: state.deployment.id,
        buildJobId: claimedJob.id,
        claimedBy: env.workerId,
        errorMessage,
        now: this.dependencies.now?.() ?? new Date(),
      });

      await this.dependencies.onStatus?.(state.deployment.id, "failure");
      try {
        await logWriter.system(`deployment marked failed: ${errorMessage}`);
      } catch (logError) {
        logger.error("Failed to append failure log", {
          buildJobId: claimedJob.id,
          deploymentId: state.deployment.id,
          error: sanitizeErrorMessage(logError),
        });
      }

      claimReleased = true;
      throw error;
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }

      if (!claimReleased) {
        await this.dependencies.buildJobRepository.releaseClaim(
          claimedJob.id,
          env.workerId,
          this.dependencies.now?.() ?? new Date(),
        );
      }

      if (workspaceDir) {
        await cleanupDirectory(workspaceDir);
      }
    }
  }
}
