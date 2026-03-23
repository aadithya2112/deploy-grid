import { Deployment } from "../domain/deployment.ts";
import { logger } from "../infrastructure/logger.ts";
import { BuildJobRepository } from "../repositories/build-job.repository.ts";
import type { DeploymentRepository } from "../repositories/deployment.repository.ts";
import { ProjectRepository } from "../repositories/project.repository.ts";
import { DeploymentQueue } from "../queues/deployment.queue.ts";
import { deriveProjectMetadata } from "../utils/project.ts";

export class InvalidDeploymentRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDeploymentRequestError";
  }
}

export class DeploymentNotFoundError extends Error {
  constructor(id: string) {
    super(`Deployment ${id} not found`);
    this.name = "DeploymentNotFoundError";
  }
}

export class DeploymentService {
  constructor(
    private readonly repo: DeploymentRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly buildJobRepo: BuildJobRepository,
    private readonly deploymentQueue: DeploymentQueue,
  ) {}

  async createDeployment(
    repoUrl: string,
    gitRef?: string,
  ): Promise<Deployment> {
    const normalizedRepoUrl = repoUrl.trim();

    if (!normalizedRepoUrl) {
      throw new InvalidDeploymentRequestError("repoUrl is required");
    }

    const project =
      (await this.projectRepo.findByRepoUrl(normalizedRepoUrl)) ??
      (await this.projectRepo.createOrGet({
        ...deriveProjectMetadata(normalizedRepoUrl),
        repoUrl: normalizedRepoUrl,
      }));

    const normalizedGitRef = gitRef?.trim() || project.defaultBranch;
    const deployment = Deployment.create({
      projectId: project.id,
      repoUrl: normalizedRepoUrl,
      gitRef: normalizedGitRef,
    });

    await this.repo.create(deployment);
    const buildJob = await this.buildJobRepo.create(deployment.id);

    try {
      await this.deploymentQueue.enqueue({
        buildJobId: buildJob.id,
        deploymentId: deployment.id,
        projectId: project.id,
        repoUrl: normalizedRepoUrl,
        gitRef: normalizedGitRef,
        rootDirectory: project.rootDirectory,
        installCommand: project.installCommand,
        buildCommand: project.buildCommand,
        outputDirectory: project.outputDirectory,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to enqueue build job";

      deployment.markFailed(errorMessage);
      await this.repo.update(deployment);
      await this.buildJobRepo.markFailed(buildJob.id, errorMessage);

      logger.error("Failed to enqueue deployment job", {
        deploymentId: deployment.id,
        buildJobId: buildJob.id,
        error: errorMessage,
      });
    }

    return deployment;
  }

  async getDeployment(id: string): Promise<Deployment> {
    return this.requireDeployment(id);
  }

  private async requireDeployment(id: string): Promise<Deployment> {
    const deployment = await this.repo.findById(id);

    if (!deployment) {
      throw new DeploymentNotFoundError(id);
    }

    return deployment;
  }
}
