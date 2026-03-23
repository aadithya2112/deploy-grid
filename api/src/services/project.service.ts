import type { NewProject, ProjectEnvVar } from "../db/schema.ts";
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
    const existingProject = await this.projectRepo.findByRepoUrl(normalizedRepoUrl);
    const values: Pick<
      NewProject,
      | "slug"
      | "name"
      | "repoUrl"
      | "defaultBranch"
      | "rootDirectory"
      | "installCommand"
      | "buildCommand"
      | "outputDirectory"
    > = {
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
      ? await this.projectRepo.updateSettings(existingProject.id, {
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
    limit: number;
    offset: number;
  }): Promise<ProjectSnapshot[]> {
    const projects = await this.projectRepo.list(options);
    return projects.map(toProjectSnapshot);
  }

  async getProject(id: string): Promise<ProjectSnapshot> {
    const project = await this.projectRepo.findById(id);

    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    return toProjectSnapshot(project);
  }

  async createDeployment(
    projectId: string,
    gitRef?: string,
  ) {
    await this.requireProject(projectId);
    return this.deploymentService.createDeploymentForProject(projectId, gitRef);
  }

  async listDeployments(
    projectId: string,
    options: { limit: number; offset: number },
  ) {
    await this.requireProject(projectId);
    return this.deploymentService.listDeploymentsByProject(projectId, options);
  }

  async listEnvVars(projectId: string): Promise<ProjectEnvVarSnapshot[]> {
    await this.requireProject(projectId);
    const envVars = await this.envVarRepo.listByProjectId(projectId);

    return envVars.map((envVar) => ({
      id: envVar.id,
      projectId: envVar.projectId,
      key: envVar.key,
      target: envVar.target,
      maskedValue: maskSecret(envVar.value),
      createdAt: envVar.createdAt.toISOString(),
      updatedAt: envVar.updatedAt.toISOString(),
    }));
  }

  async upsertEnvVar(
    projectId: string,
    input: {
      key: string;
      value: string;
      target?: ProjectEnvVar["target"];
    },
  ): Promise<ProjectEnvVarSnapshot> {
    await this.requireProject(projectId);

    const key = input.key.trim();
    const value = input.value;

    if (!key) {
      throw new InvalidProjectRequestError("key is required");
    }

    const envVar = await this.envVarRepo.upsert({
      projectId,
      key,
      value,
      target: input.target ?? "all",
    });

    return {
      id: envVar.id,
      projectId: envVar.projectId,
      key: envVar.key,
      target: envVar.target,
      maskedValue: maskSecret(envVar.value),
      createdAt: envVar.createdAt.toISOString(),
      updatedAt: envVar.updatedAt.toISOString(),
    };
  }

  async deleteEnvVar(
    projectId: string,
    key: string,
    target: ProjectEnvVar["target"],
  ): Promise<void> {
    await this.requireProject(projectId);

    if (!key.trim()) {
      throw new InvalidProjectRequestError("key is required");
    }

    await this.envVarRepo.delete(projectId, key.trim(), target);
  }

  private async requireProject(id: string) {
    const project = await this.projectRepo.findById(id);

    if (!project) {
      throw new ProjectNotFoundError(id);
    }

    return project;
  }
}
