import "server-only"

import type {
  DeploymentLogsResponse,
  DeploymentSnapshot,
  HealthSnapshot,
  ProjectDeploymentsResponse,
  ProjectEnvVarListResponse,
  ProjectListResponse,
  ProjectSnapshot,
} from "@/lib/types"

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
  clerkUserId?: string
}

export interface CreateProjectInput {
  repoUrl: string
  name?: string
  defaultBranch?: string
  rootDirectory?: string | null
  installCommand?: string | null
  buildCommand?: string | null
  outputDirectory?: string | null
}

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

function getApiBaseUrl(): string {
  return (
    process.env.DEPLOY_GRID_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000"
  )
}

function getApiAuthToken(): string | null {
  return process.env.DEPLOY_GRID_API_TOKEN ?? process.env.API_AUTH_TOKEN ?? null
}

async function requestApi<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const token = getApiAuthToken()
  const method = options.method ?? "GET"
  const headers = new Headers({
    Accept: "application/json",
  })

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (options.clerkUserId) {
    headers.set("x-clerk-user-id", options.clerkUserId)
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })

  if (!response.ok) {
    let message = `Request failed with ${response.status}`

    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) {
        message = body.error
      }
    } catch {
      // Ignore JSON parse errors and keep fallback message.
    }

    throw new ApiRequestError(message, response.status)
  }

  return (await response.json()) as T
}

export function getApiBaseUrlForUi(): string {
  return getApiBaseUrl()
}

export async function getHealth(): Promise<HealthSnapshot> {
  return requestApi<HealthSnapshot>("/health")
}

export async function listProjects(
  clerkUserId: string,
  options?: {
    query?: string
    limit?: number
    offset?: number
  }
): Promise<ProjectListResponse> {
  const params = new URLSearchParams()

  if (options?.query) {
    params.set("query", options.query)
  }

  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit))
  }

  if (typeof options?.offset === "number") {
    params.set("offset", String(options.offset))
  }

  const query = params.toString()
  return requestApi<ProjectListResponse>(`/projects${query ? `?${query}` : ""}`, {
    clerkUserId,
  })
}

export async function getProject(
  clerkUserId: string,
  projectId: string
): Promise<ProjectSnapshot> {
  return requestApi<ProjectSnapshot>(`/projects/${projectId}`, {
    clerkUserId,
  })
}

export async function listProjectDeployments(
  clerkUserId: string,
  projectId: string,
  options?: {
    status?: "queued" | "building" | "ready" | "failed" | "cancelled"
    gitRef?: string
    limit?: number
    offset?: number
  }
): Promise<ProjectDeploymentsResponse> {
  const params = new URLSearchParams()

  if (options?.status) {
    params.set("status", options.status)
  }

  if (options?.gitRef) {
    params.set("gitRef", options.gitRef)
  }

  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit))
  }

  if (typeof options?.offset === "number") {
    params.set("offset", String(options.offset))
  }

  const query = params.toString()
  return requestApi<ProjectDeploymentsResponse>(
    `/projects/${projectId}/deployments${query ? `?${query}` : ""}`,
    {
      clerkUserId,
    }
  )
}

export async function listProjectEnvVars(
  clerkUserId: string,
  projectId: string
): Promise<ProjectEnvVarListResponse> {
  return requestApi<ProjectEnvVarListResponse>(`/projects/${projectId}/env-vars`, {
    clerkUserId,
  })
}

export async function getDeployment(
  clerkUserId: string,
  deploymentId: string
): Promise<DeploymentSnapshot> {
  return requestApi<DeploymentSnapshot>(`/deployments/${deploymentId}`, {
    clerkUserId,
  })
}

export async function listDeploymentLogs(
  clerkUserId: string,
  deploymentId: string,
  options?: {
    limit?: number
    afterSequence?: number
  }
): Promise<DeploymentLogsResponse> {
  const params = new URLSearchParams()

  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit))
  }

  if (typeof options?.afterSequence === "number") {
    params.set("afterSequence", String(options.afterSequence))
  }

  const query = params.toString()
  return requestApi<DeploymentLogsResponse>(
    `/deployments/${deploymentId}/logs${query ? `?${query}` : ""}`,
    {
      clerkUserId,
    }
  )
}

export async function createProject(
  clerkUserId: string,
  input: CreateProjectInput
): Promise<ProjectSnapshot> {
  return requestApi<ProjectSnapshot>("/projects", {
    method: "POST",
    body: input,
    clerkUserId,
  })
}

export async function createProjectDeployment(
  clerkUserId: string,
  projectId: string,
  input?: {
    gitRef?: string
  }
): Promise<DeploymentSnapshot> {
  return requestApi<DeploymentSnapshot>(`/projects/${projectId}/deployments`, {
    method: "POST",
    body: input,
    clerkUserId,
  })
}
