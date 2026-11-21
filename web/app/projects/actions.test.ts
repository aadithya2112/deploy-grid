import { beforeEach, describe, expect, test, vi } from "vitest"

import { redirectMock, resetNavigationMocks } from "@/tests/support/navigation"

const {
  getAuthMock,
  createProjectMock,
  createProjectDeploymentMock,
  redeployDeploymentMock,
  updateProjectMock,
  upsertProjectEnvVarMock,
  deleteProjectEnvVarMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  createProjectMock: vi.fn(),
  createProjectDeploymentMock: vi.fn(),
  redeployDeploymentMock: vi.fn(),
  updateProjectMock: vi.fn(),
  upsertProjectEnvVarMock: vi.fn(),
  deleteProjectEnvVarMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("@/lib/auth", () => ({
  getAuth: getAuthMock,
}))

vi.mock("@/lib/api", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  createProject: createProjectMock,
  createProjectDeployment: createProjectDeploymentMock,
  redeployDeployment: redeployDeploymentMock,
  updateProject: updateProjectMock,
  upsertProjectEnvVar: upsertProjectEnvVarMock,
  deleteProjectEnvVar: deleteProjectEnvVarMock,
}))

import {
  createProjectAndDeployAction,
  deleteProjectEnvVarAction,
  deployProjectAction,
  redeployDeploymentAction,
  updateProjectSettingsAction,
  upsertProjectEnvVarAction,
} from "./actions"

describe("project actions", () => {
  beforeEach(() => {
    resetNavigationMocks()
    revalidatePathMock.mockReset()
    getAuthMock.mockReset()
    createProjectMock.mockReset()
    createProjectDeploymentMock.mockReset()
    redeployDeploymentMock.mockReset()
    updateProjectMock.mockReset()
    upsertProjectEnvVarMock.mockReset()
    deleteProjectEnvVarMock.mockReset()

    getAuthMock.mockResolvedValue({ userId: "user_123" })
    createProjectMock.mockResolvedValue({
      id: "project-123",
      slug: "project-123",
      name: "Demo App",
      repoUrl: "https://github.com/acme/demo.git",
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: null,
      buildCommand: null,
      outputDirectory: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    })
    createProjectDeploymentMock.mockResolvedValue({
      id: "deployment-123",
      projectId: "project-123",
      repoUrl: "https://github.com/acme/demo.git",
      gitRef: "main",
      status: "queued",
      commitSha: null,
      previewUrl: null,
      artifactUrl: null,
      buildStartedAt: null,
      buildFinishedAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      errorMessage: null,
    })
    redeployDeploymentMock.mockResolvedValue({
      id: "deployment-redeploy-1",
      projectId: "project-123",
    })
    updateProjectMock.mockResolvedValue({})
    upsertProjectEnvVarMock.mockResolvedValue({})
    deleteProjectEnvVarMock.mockResolvedValue(undefined)
  })

  test("creates a project, starts deployment, and redirects to logs", async () => {
    const formData = new FormData()
    formData.set("repoUrl", "https://github.com/acme/demo.git")
    formData.set("name", " Demo App ")
    formData.set("defaultBranch", " main ")

    await expect(createProjectAndDeployAction(formData)).rejects.toMatchObject({
      location: "/projects/project-123/deployments/deployment-123",
    })

    expect(createProjectMock).toHaveBeenCalledWith("user_123", {
      repoUrl: "https://github.com/acme/demo.git",
      name: "Demo App",
      defaultBranch: "main",
      rootDirectory: null,
      installCommand: null,
      buildCommand: null,
      outputDirectory: null,
    })
    expect(createProjectDeploymentMock).toHaveBeenCalledWith(
      "user_123",
      "project-123"
    )
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects/project-123")
  })

  test("creates a deployment from the project page and redirects to the new deployment route", async () => {
    const formData = new FormData()
    formData.set("projectId", "project-123")
    formData.set("gitRef", "main")

    await expect(deployProjectAction(formData)).rejects.toMatchObject({
      location: "/projects/project-123/deployments/deployment-123",
    })

    expect(createProjectDeploymentMock).toHaveBeenCalledWith(
      "user_123",
      "project-123",
      {
        gitRef: "main",
      }
    )
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects/project-123")
  })

  test("redeploys a specific deployment and redirects to the new build", async () => {
    const formData = new FormData()
    formData.set("projectId", "project-123")
    formData.set("deploymentId", "deployment-old")

    await expect(redeployDeploymentAction(formData)).rejects.toMatchObject({
      location: "/projects/project-123/deployments/deployment-redeploy-1",
    })

    expect(redeployDeploymentMock).toHaveBeenCalledWith(
      "user_123",
      "deployment-old"
    )
  })

  test("updates project build settings and redirects with confirmation notice", async () => {
    const formData = new FormData()
    formData.set("projectId", "project-123")
    formData.set("defaultBranch", "develop")
    formData.set("buildCommand", "bun run build")
    formData.set("outputDirectory", "out")

    await expect(updateProjectSettingsAction(formData)).rejects.toMatchObject({
      location:
        "/projects/project-123?notice=Build%20settings%20updated#configuration",
    })

    expect(updateProjectMock).toHaveBeenCalledWith("user_123", "project-123", {
      defaultBranch: "develop",
      rootDirectory: null,
      installCommand: null,
      buildCommand: "bun run build",
      outputDirectory: "out",
    })
  })

  test("upserts and deletes project environment variables", async () => {
    const upsertForm = new FormData()
    upsertForm.set("projectId", "project-123")
    upsertForm.set("key", "VITE_API_URL")
    upsertForm.set("value", "https://api.example.com")
    upsertForm.set("target", "production")

    await expect(upsertProjectEnvVarAction(upsertForm)).rejects.toMatchObject({
      location:
        "/projects/project-123?notice=Saved%20VITE_API_URL#environment",
    })
    expect(upsertProjectEnvVarMock).toHaveBeenCalledWith(
      "user_123",
      "project-123",
      "VITE_API_URL",
      { value: "https://api.example.com", target: "production" }
    )

    const deleteForm = new FormData()
    deleteForm.set("projectId", "project-123")
    deleteForm.set("key", "VITE_API_URL")
    deleteForm.set("target", "production")

    await expect(deleteProjectEnvVarAction(deleteForm)).rejects.toMatchObject({
      location:
        "/projects/project-123?notice=Deleted%20VITE_API_URL#environment",
    })
    expect(deleteProjectEnvVarMock).toHaveBeenCalledWith(
      "user_123",
      "project-123",
      "VITE_API_URL",
      "production"
    )
  })
})
