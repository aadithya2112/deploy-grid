import type { DeploymentSnapshot } from "./deployment.types.ts";
import type { DeploymentStatus } from "./deployment.types.ts";

export class Deployment {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly repoUrl: string,
    public readonly gitRef: string,
    public status: DeploymentStatus,
    public commitSha: string | null,
    public previewUrl: string | null,
    public artifactUrl: string | null,
    public buildStartedAt: string | null,
    public buildFinishedAt: string | null,
    public readonly createdAt: string,
    public updatedAt: string,
    public errorMessage: string | null = null,
  ) {}

  static create(input: {
    projectId: string;
    repoUrl: string;
    gitRef: string;
  }): Deployment {
    const timestamp = new Date().toISOString();

    return new Deployment(
      crypto.randomUUID(),
      input.projectId,
      input.repoUrl,
      input.gitRef,
      "queued",
      null,
      null,
      null,
      null,
      null,
      timestamp,
      timestamp,
    );
  }

  static hydrate(snapshot: DeploymentSnapshot): Deployment {
    return new Deployment(
      snapshot.id,
      snapshot.projectId,
      snapshot.repoUrl,
      snapshot.gitRef,
      snapshot.status,
      snapshot.commitSha,
      snapshot.previewUrl,
      snapshot.artifactUrl,
      snapshot.buildStartedAt,
      snapshot.buildFinishedAt,
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.errorMessage,
    );
  }

  startBuild(): void {
    this.status = "building";
    this.errorMessage = null;
    this.buildStartedAt = new Date().toISOString();
    this.touch();
  }

  markSuccess(): void {
    this.status = "ready";
    this.errorMessage = null;
    this.buildFinishedAt = new Date().toISOString();
    this.touch();
  }

  markFailed(errorMessage?: string): void {
    this.status = "failed";
    this.errorMessage = errorMessage ?? "Build failed";
    this.buildFinishedAt = new Date().toISOString();
    this.touch();
  }

  toJSON(): DeploymentSnapshot {
    return {
      id: this.id,
      projectId: this.projectId,
      repoUrl: this.repoUrl,
      gitRef: this.gitRef,
      status: this.status,
      commitSha: this.commitSha,
      previewUrl: this.previewUrl,
      artifactUrl: this.artifactUrl,
      buildStartedAt: this.buildStartedAt,
      buildFinishedAt: this.buildFinishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      errorMessage: this.errorMessage,
    };
  }

  private touch(): void {
    this.updatedAt = new Date().toISOString();
  }
}
