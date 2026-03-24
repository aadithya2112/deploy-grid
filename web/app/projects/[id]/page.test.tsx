import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  notFoundMock,
  redirectMock,
  resetNavigationMocks,
} from "@/tests/support/navigation"
import { renderServerComponent } from "@/tests/support/server-component"

const {
  getAuthMock,
  getProjectMock,
  listProjectDeploymentsMock,
  listProjectEnvVarsMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getProjectMock: vi.fn(),
  listProjectDeploymentsMock: vi.fn(),
  listProjectEnvVarsMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}))

vi.mock("@/lib/auth", () => ({
  getAuth: getAuthMock,
}))

vi.mock("@/lib/api", async () => {
  class ApiRequestError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.name = "ApiRequestError"
      this.status = status
    }
  }

  return {
    ApiRequestError,
    getProject: getProjectMock,
    listProjectDeployments: listProjectDeploymentsMock,
    listProjectEnvVars: listProjectEnvVarsMock,
  }
})

import ProjectDetailPage from "./page"

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    resetNavigationMocks()
    getAuthMock.mockReset()
    getProjectMock.mockReset()
    listProjectDeploymentsMock.mockReset()
    listProjectEnvVarsMock.mockReset()

    getAuthMock.mockResolvedValue({ userId: "user_123" })
    getProjectMock.mockResolvedValue({
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
    listProjectDeploymentsMock.mockResolvedValue({
      projectId: "project-123",
      deployments: [
        {
          id: "deployment-123",
          projectId: "project-123",
          repoUrl: "https://github.com/acme/demo.git",
          gitRef: "main",
          status: "ready",
          commitSha: "abc123",
          previewUrl: null,
          artifactUrl: null,
          buildStartedAt: "2025-01-01T00:00:00.000Z",
          buildFinishedAt: "2025-01-01T00:01:00.000Z",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:01:00.000Z",
          errorMessage: null,
        },
      ],
      pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
    })
    listProjectEnvVarsMock.mockResolvedValue({
      projectId: "project-123",
      envVars: [],
    })
  })

  test("redirects signed-out users to sign-in", async () => {
    getAuthMock.mockResolvedValueOnce({ userId: null })

    await expect(
      ProjectDetailPage({ params: Promise.resolve({ id: "project-123" }) })
    ).rejects.toMatchObject({ location: "/sign-in" })
  })

  test("renders the latest deployment summary and primary redeploy action", async () => {
    await renderServerComponent(
      ProjectDetailPage({ params: Promise.resolve({ id: "project-123" }) })
    )

    expect(screen.getByText("Latest deployment")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /redeploy latest/i })
    ).toBeInTheDocument()
    expect(screen.getByText("Recent deployments")).toBeInTheDocument()
  })

  test("shows a deploy CTA when the project has no deployments", async () => {
    listProjectDeploymentsMock.mockResolvedValueOnce({
      projectId: "project-123",
      deployments: [],
      pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
    })

    await renderServerComponent(
      ProjectDetailPage({ params: Promise.resolve({ id: "project-123" }) })
    )

    expect(screen.getAllByRole("button", { name: /deploy now/i }).length).toBeGreaterThan(0)
  })
})
