import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  notFoundMock,
  redirectMock,
  resetNavigationMocks,
  useRouterMock,
} from "@/tests/support/navigation"
import { renderServerComponent } from "@/tests/support/server-component"

const { getAuthMock, getDeploymentMock, listDeploymentLogsMock } = vi.hoisted(
  () => ({
    getAuthMock: vi.fn(),
    getDeploymentMock: vi.fn(),
    listDeploymentLogsMock: vi.fn(),
  })
)

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: useRouterMock,
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
    getDeployment: getDeploymentMock,
    listDeploymentLogs: listDeploymentLogsMock,
  }
})

import { ApiRequestError } from "@/lib/api"
import DeploymentDetailPage from "./page"

describe("DeploymentDetailPage", () => {
  const baseDeployment = {
    id: "deployment-123",
    projectId: "project-123",
    repoUrl: "https://github.com/acme/demo.git",
    gitRef: "main",
    status: "building",
    commitSha: null,
    previewUrl: null,
    artifactUrl: null,
    buildStartedAt: "2025-01-01T00:00:00.000Z",
    buildFinishedAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
  }

  beforeEach(() => {
    resetNavigationMocks()
    getAuthMock.mockReset()
    getDeploymentMock.mockReset()
    listDeploymentLogsMock.mockReset()

    getAuthMock.mockResolvedValue({ userId: "user_123" })
    getDeploymentMock.mockResolvedValue(baseDeployment)
    listDeploymentLogsMock.mockResolvedValue({
      deploymentId: "deployment-123",
      logs: [
        {
          id: "log-1",
          deploymentId: "deployment-123",
          stream: "system",
          sequence: 1,
          message: "repository cloned",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    })
  })

  test("redirects signed-out users to sign-in", async () => {
    getAuthMock.mockResolvedValueOnce({ userId: null })

    await expect(
      DeploymentDetailPage({
        params: Promise.resolve({ id: "project-123", deploymentId: "deployment-123" }),
      })
    ).rejects.toMatchObject({ location: "/sign-in" })
    expect(redirectMock).toHaveBeenCalledWith("/sign-in")
  })

  test("returns notFound when deployment is missing", async () => {
    getDeploymentMock.mockRejectedValueOnce(new ApiRequestError("missing", 404))

    await expect(
      DeploymentDetailPage({
        params: Promise.resolve({ id: "project-123", deploymentId: "deployment-123" }),
      })
    ).rejects.toMatchObject({ name: "NotFoundError" })
    expect(notFoundMock).toHaveBeenCalled()
  })

  test("returns notFound when deployment belongs to a different project", async () => {
    getDeploymentMock.mockResolvedValueOnce({
      ...baseDeployment,
      projectId: "other-project",
    })

    await expect(
      DeploymentDetailPage({
        params: Promise.resolve({ id: "project-123", deploymentId: "deployment-123" }),
      })
    ).rejects.toMatchObject({ name: "NotFoundError" })
    expect(notFoundMock).toHaveBeenCalled()
    expect(listDeploymentLogsMock).not.toHaveBeenCalled()
  })

  test("renders running state copy and logs for active deployments", async () => {
    await renderServerComponent(
      DeploymentDetailPage({
        params: Promise.resolve({ id: "project-123", deploymentId: "deployment-123" }),
      })
    )

    expect(
      screen.getByText("Refreshing while this deployment is still running.")
    ).toBeInTheDocument()
    expect(screen.getByText("repository cloned")).toBeInTheDocument()
  })
})
