export const deploymentStatuses = [
  "queued",
  "building",
  "ready",
  "failed",
  "cancelled",
] as const;

export type DeploymentStatus = (typeof deploymentStatuses)[number];

export interface DeploymentSnapshot {
  id: string;
  projectId: string;
  repoUrl: string;
  gitRef: string;
  status: DeploymentStatus;
  commitSha: string | null;
  previewUrl: string | null;
  artifactUrl: string | null;
  buildStartedAt: string | null;
  buildFinishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
}
