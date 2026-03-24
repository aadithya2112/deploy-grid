import { beforeEach, describe, expect, test, vi } from "vitest"

import { redirectMock, resetNavigationMocks } from "@/tests/support/navigation"

const {
  getAuthMock,
  createProjectMock,
  createProjectDeploymentMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  createProjectMock: vi.fn(),
  createProjectDeploymentMock: vi.fn(),
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
  createProject: createProjectMock,
  createProjectDeployment: createProjectDeploymentMock,
}))

import {
  createProjectAndDeployAction,
  deployProjectAction,
} from "./actions"

describe("project actions", () => {
  beforeEach(() => {
    resetNavigationMocks()
    revalidatePathMock.mockReset()
    getAuthMock.mockReset()
    createProjectMock.mockReset()
    createProjectDeploymentMock.mockReset()

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
    expect(createProjectDeploymentMock).toHaveBeenCalledWith("user_123", "project-123")
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

    expect(createProjectDeploymentMock).toHaveBeenCalledWith("user_123", "project-123", {
      gitRef: "main",
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard")
    expect(revalidatePathMock).toHaveBeenCalledWith("/projects/project-123")
  })
})
