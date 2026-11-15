import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
  notFoundMock,
  redirectMock,
  resetNavigationMocks,
} from "@/tests/support/navigation"

const {
  getAuthMock,
  getProjectMock,
  getPlatformOverviewMock,
  listDeploymentsMock,
  listVariablesMock,
  requestApiMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getProjectMock: vi.fn(),
  getPlatformOverviewMock: vi.fn(),
  listDeploymentsMock: vi.fn(),
  listVariablesMock: vi.fn(),
  requestApiMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }))
vi.mock("@/lib/api", () => ({
  ApiRequestError: class extends Error {},
  getProject: getProjectMock,
  getPlatformOverview: getPlatformOverviewMock,
  listProjectDeployments: listDeploymentsMock,
  listProjectEnvVars: listVariablesMock,
  requestApi: requestApiMock,
}))

import ManageProject from "./page"
import { manageProjectAction } from "./actions"

const projectId = "12345678-1234-1234-1234-123456789012"
const pageProps = () => ({
  params: Promise.resolve({ id: projectId }),
  searchParams: Promise.resolve({}),
})

describe("static platform rollout access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetNavigationMocks()
    vi.stubEnv("STATIC_PLATFORM_ENABLED", undefined)
    getAuthMock.mockResolvedValue({ userId: "user_123" })
    getProjectMock.mockResolvedValue({
      id: projectId,
      name: "Demo",
      defaultBranch: "main",
    })
    getPlatformOverviewMock.mockResolvedValue({
      builds: [],
      history: [],
      release: null,
      productionUrl: null,
    })
    listDeploymentsMock.mockResolvedValue({ deployments: [] })
    listVariablesMock.mockResolvedValue({ envVars: [] })
    requestApiMock.mockResolvedValue({})
  })
  afterEach(() => vi.unstubAllEnvs())

  test.each([undefined, "false", "TRUE", "1"])(
    "direct page access is denied with flag %s before any backend request",
    async (flag) => {
      vi.stubEnv("STATIC_PLATFORM_ENABLED", flag)
      await expect(ManageProject(pageProps())).rejects.toMatchObject({
        name: "NotFoundError",
      })
      expect(getAuthMock).not.toHaveBeenCalled()
      expect(getPlatformOverviewMock).not.toHaveBeenCalled()
      expect(getProjectMock).not.toHaveBeenCalled()
    }
  )

  test.each(["promote", "cancel", "deploy", "settings", "env", "delete-env"])(
    "direct %s action is denied while disabled",
    async (operation) => {
      const form = new FormData()
      form.set("projectId", projectId)
      form.set("operation", operation)
      await expect(manageProjectAction(form)).rejects.toMatchObject({
        name: "NotFoundError",
      })
      expect(requestApiMock).not.toHaveBeenCalled()
      expect(revalidatePathMock).not.toHaveBeenCalled()
      expect(getAuthMock).not.toHaveBeenCalled()
    }
  )

  test("enabled page loads platform data for the authenticated user", async () => {
    vi.stubEnv("STATIC_PLATFORM_ENABLED", "true")
    await expect(ManageProject(pageProps())).resolves.toBeDefined()
    expect(getPlatformOverviewMock).toHaveBeenCalledWith("user_123", projectId)
  })

  test("enabled actions still require authentication", async () => {
    vi.stubEnv("STATIC_PLATFORM_ENABLED", "true")
    getAuthMock.mockResolvedValue({ userId: null })
    await expect(manageProjectAction(new FormData())).rejects.toMatchObject({
      location: "/sign-in",
    })
    expect(requestApiMock).not.toHaveBeenCalled()
  })

  test("enabled promotion reaches the backend and returns to release management", async () => {
    vi.stubEnv("STATIC_PLATFORM_ENABLED", "true")
    const form = new FormData()
    form.set("projectId", projectId)
    form.set("operation", "promote")
    form.set("deploymentId", "deployment-123")
    await expect(manageProjectAction(form)).rejects.toMatchObject({
      location: `/projects/${projectId}/manage?notice=Production%20release%20updated`,
    })
    expect(requestApiMock).toHaveBeenCalledWith(
      `/projects/${projectId}/promote`,
      {
        method: "POST",
        clerkUserId: "user_123",
        body: { deploymentId: "deployment-123" },
      }
    )
  })
})
