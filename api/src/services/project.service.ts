import type { NewProject, ProjectEnvVar } from "../db/schema.ts";
import { decryptProjectEnvValue, encryptProjectEnvValue } from "../infrastructure/project-env-crypto.ts";
import type { DeploymentStatus } from "../domain/deployment.types.ts";
import { ProjectEnvVarRepository } from "../repositories/project-env-var.repository.ts";
import { ProjectRepository } from "../repositories/project.repository.ts";
import { deriveProjectMetadata } from "../utils/project.ts";
import type { DeploymentService } from "./deployment.service.ts";

export class InvalidProjectRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProjectRequestError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project ${id} not found`);
    this.name = "ProjectNotFoundError";
  }
}

export interface ProjectSnapshot {
  id: string;
  slug: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  rootDirectory: string | null;
  installCommand: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectEnvVarSnapshot {
  id: string;
  projectId: string;
  key: string;
  target: ProjectEnvVar["target"];
  maskedValue: string;
  createdAt: string;
  updatedAt: string;
}

function toProjectSnapshot(project: {
  id: string;
  slug: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  rootDirectory: string | null;
  installCommand: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectSnapshot {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    repoUrl: project.repoUrl,
    defaultBranch: project.defaultBranch,
    rootDirectory: project.rootDirectory,
    installCommand: project.installCommand,
    buildCommand: project.buildCommand,
    outputDirectory: project.outputDirectory,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function maskSecret(value: string): string {
  if (value.length <= 4) {
    return "*".repeat(Math.max(4, value.length));
  }

  return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

export class ProjectService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly envVarRepo: ProjectEnvVarRepository,
    private readonly deploymentService: DeploymentService,
  ) {}

  async createProject(
    clerkUserId: string,
    input: {
      repoUrl: string;
      name?: string;
      defaultBranch?: string;
      rootDirectory?: string | null;
      installCommand?: string | null;
      buildCommand?: string | null;
      outputDirectory?: string | null;
    },
  ): Promise<ProjectSnapshot> {
    const normalizedRepoUrl = input.repoUrl.trim();

    if (!normalizedRepoUrl) {
      throw new InvalidProjectRequestError("repoUrl is required");
    }

    const metadata = deriveProjectMetadata(normalizedRepoUrl);
    const existingProject = await this.projectRepo.findByRepoUrl(
      normalizedRepoUrl,
      clerkUserId,
    );
    const values: Pick<
      NewProject,
      | "clerkUserId"
      | "slug"
      | "name"
      | "repoUrl"
      | "defaultBranch"
      | "rootDirectory"
      | "installCommand"
      | "buildCommand"
      | "outputDirectory"
    > = {
      clerkUserId,
      slug: existingProject?.slug ?? metadata.slug,
      name: input.name?.trim() || metadata.name,
      repoUrl: normalizedRepoUrl,
      defaultBranch:
        input.defaultBranch?.trim() ||
        existingProject?.defaultBranch ||
        "main",
      rootDirectory:
        input.rootDirectory?.trim() ??
        existingProject?.rootDirectory ??
        null,
      installCommand:
        input.installCommand?.trim() ??
        existingProject?.installCommand ??
        null,
      buildCommand:
        input.buildCommand?.trim() ?? existingProject?.buildCommand ?? null,
      outputDirectory:
        input.outputDirectory?.trim() ??
        existingProject?.outputDirectory ??
        null,
    };

    const project = existingProject
      ? await this.projectRepo.updateSettings(existingProject.id, clerkUserId, {
          name: values.name,
          defaultBranch: values.defaultBranch,
          rootDirectory: values.rootDirectory,
          installCommand: values.installCommand,
          buildCommand: values.buildCommand,
          outputDirectory: values.outputDirectory,
        })
      : await this.projectRepo.create(values);

    if (!project) {
      throw new Error("Failed to create or update project");
    }

    return toProjectSnapshot(project);
  }

  async listProjects(options: {
    clerkUserId: string;
    limit: number;
    offset: number;
    query?: string;
  }): Promise<ProjectSnapshot[]> {
    const projects = await this.projectRepo.list(options);
    return projects.map(toProjectSnapshot);
  }

  async getProject(clerkUserId: string, id: string): Promise<ProjectSnapshot> {
    const project = await this.projectRepo.findById(id, clerkUserId);

    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    return toProjectSnapshot(project);
  }

  async createDeployment(
    clerkUserId: string,
    projectId: string,
    gitRef?: string,
  ) {
    await this.requireProject(projectId, clerkUserId);
    return this.deploymentService.createDeploymentForProject(
      projectId,
      clerkUserId,
      gitRef,
    );
  }

  async listDeployments(
    clerkUserId: string,
    projectId: string,
    options: {
      limit: number;
      offset: number;
      status?: DeploymentStatus;
      gitRef?: string;
    },
  ) {
    await this.requireProject(projectId, clerkUserId);
    return this.deploymentService.listDeploymentsByProject(projectId, options);
  }

  async listEnvVars(
    clerkUserId: string,
    projectId: string,
  ): Promise<ProjectEnvVarSnapshot[]> {
    await this.requireProject(projectId, clerkUserId);
    const envVars = await this.envVarRepo.listByProjectId(projectId);

    return Promise.all(
      envVars.map(async (envVar) => {
        const decryptedValue = await decryptProjectEnvValue(envVar.value);

        return {
          id: envVar.id,
          projectId: envVar.projectId,
          key: envVar.key,
          target: envVar.target,
          maskedValue: maskSecret(decryptedValue),
          createdAt: envVar.createdAt.toISOString(),
          updatedAt: envVar.updatedAt.toISOString(),
        };
      }),
    );
  }

  async upsertEnvVar(
    clerkUserId: string,
    projectId: string,
    input: {
      key: string;
      value: string;
      target?: ProjectEnvVar["target"];
    },
  ): Promise<ProjectEnvVarSnapshot> {
    await this.requireProject(projectId, clerkUserId);

    const key = input.key.trim();
    const value = input.value;

    if (!key) {
      throw new InvalidProjectRequestError("key is required");
    }

    const encryptedValue = await encryptProjectEnvValue(value);

    const envVar = await this.envVarRepo.upsert({
      projectId,
      key,
      value: encryptedValue,
      target: input.target ?? "all",
    });

    const decryptedValue = await decryptProjectEnvValue(envVar.value);

    return {
      id: envVar.id,
      projectId: envVar.projectId,
      key: envVar.key,
      target: envVar.target,
      maskedValue: maskSecret(decryptedValue),
      createdAt: envVar.createdAt.toISOString(),
      updatedAt: envVar.updatedAt.toISOString(),
    };
  }

  async deleteEnvVar(
    clerkUserId: string,
    projectId: string,
    key: string,
    target: ProjectEnvVar["target"],
  ): Promise<void> {
    await this.requireProject(projectId, clerkUserId);

    if (!key.trim()) {
      throw new InvalidProjectRequestError("key is required");
    }

    await this.envVarRepo.delete(projectId, key.trim(), target);
  }

  async updateProject(
    clerkUserId: string,
    id: string,
    input: {
      name?: string;
      defaultBranch?: string;
      rootDirectory?: string | null;
      installCommand?: string | null;
      buildCommand?: string | null;
      outputDirectory?: string | null;
    },
  ): Promise<ProjectSnapshot> {
    await this.requireProject(id, clerkUserId);

    const project = await this.projectRepo.updateSettings(id, clerkUserId, {
      name: input.name?.trim(),
      defaultBranch: input.defaultBranch?.trim(),
      rootDirectory: input.rootDirectory?.trim() ?? input.rootDirectory,
      installCommand: input.installCommand?.trim() ?? input.installCommand,
      buildCommand: input.buildCommand?.trim() ?? input.buildCommand,
      outputDirectory: input.outputDirectory?.trim() ?? input.outputDirectory,
    });

    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    return toProjectSnapshot(project);
  }

  private async requireProject(id: string, clerkUserId: string) {
    const project = await this.projectRepo.findById(id, clerkUserId);

    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    return project;
  }
}
