export interface HealthSnapshot {
  status: "ok" | "degraded"
  database: "ok" | "error"
}

export type DeploymentStatus =
  | "queued"
  | "building"
  | "ready"
  | "failed"
  | "cancelled"

export interface ProjectSnapshot {
  id: string
  slug: string
  name: string
  repoUrl: string
  defaultBranch: string
  rootDirectory: string | null
  installCommand: string | null
  buildCommand: string | null
  outputDirectory: string | null
  createdAt: string
  updatedAt: string
}

export interface PageInfo {
  limit: number
  offset: number
  hasMore: boolean
  nextOffset: number | null
}

export interface ProjectListResponse {
  projects: ProjectSnapshot[]
  pageInfo: PageInfo
}

export interface ProjectEnvVarSnapshot {
  id: string
  projectId: string
  key: string
  target: "all" | "preview" | "production"
  maskedValue: string
  createdAt: string
  updatedAt: string
}

export interface ProjectEnvVarListResponse {
  projectId: string
  envVars: ProjectEnvVarSnapshot[]
}

export interface DeploymentSnapshot {
  id: string
  projectId: string
  repoUrl: string
  gitRef: string
  status: DeploymentStatus
  commitSha: string | null
  previewUrl: string | null
  artifactUrl: string | null
  buildStartedAt: string | null
  buildFinishedAt: string | null
  createdAt: string
  updatedAt: string
  errorMessage: string | null
}

export interface ProjectDeploymentsResponse {
  projectId: string
  deployments: DeploymentSnapshot[]
  pageInfo: PageInfo
}

export interface DeploymentLogEntry {
  id: string
  deploymentId: string
  stream: "stdout" | "stderr" | "system"
  sequence: number
  message: string
  createdAt: string
}

export interface DeploymentLogsResponse {
  deploymentId: string
  logs: DeploymentLogEntry[]
}
