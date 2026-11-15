import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const {
  getAuthMock,
  getProjectMock,
  requestApiMock,
  cookiesMock,
  cookieGetMock,
  cookieSetMock,
  cookieDeleteMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getProjectMock: vi.fn(),
  requestApiMock: vi.fn(),
  cookiesMock: vi.fn(),
  cookieGetMock: vi.fn(),
  cookieSetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
}))
vi.mock("next/headers", () => ({ cookies: cookiesMock }))
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }))
vi.mock("@/lib/api", () => ({
  ApiRequestError: class extends Error {},
  getProject: getProjectMock,
  requestApi: requestApiMock,
}))

import { GET as connect } from "./connect/route"
import { GET as callback } from "./callback/route"

const projectId = "12345678-1234-1234-1234-123456789012"
const origin = "https://dashboard.example.com"

describe("GitHub rollout access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("STATIC_PLATFORM_ENABLED", undefined)
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client")
    vi.stubEnv("WEB_BASE_URL", origin)
    getAuthMock.mockResolvedValue({ userId: "user_123" })
    getProjectMock.mockResolvedValue({ id: projectId })
    cookiesMock.mockResolvedValue({
      get: cookieGetMock,
      set: cookieSetMock,
      delete: cookieDeleteMock,
    })
    cookieGetMock.mockReturnValue({
      value: JSON.stringify({
        state: "test-state",
        userId: "user_123",
        projectId,
      }),
    })
    requestApiMock.mockResolvedValue({})
  })
  afterEach(() => vi.unstubAllEnvs())

  test.each([undefined, "false", "TRUE", "1"])(
    "both OAuth routes return 404 with flag %s without cookie or backend access",
    async (flag) => {
      vi.stubEnv("STATIC_PLATFORM_ENABLED", flag)
      for (const handler of [connect, callback]) {
        const response = await handler(
          new Request(`${origin}/api/github/connect?projectId=${projectId}`)
        )
        expect(response.status).toBe(404)
      }
      expect(getAuthMock).not.toHaveBeenCalled()
      expect(cookiesMock).not.toHaveBeenCalled()
      expect(getProjectMock).not.toHaveBeenCalled()
      expect(requestApiMock).not.toHaveBeenCalled()
    }
  )

  test("enabled connect checks ownership and starts GitHub authorization", async () => {
    vi.stubEnv("STATIC_PLATFORM_ENABLED", "true")
    const response = await connect(
      new Request(`${origin}/api/github/connect?projectId=${projectId}`)
    )
    expect(response.status).toBe(302)
    const redirect = new URL(response.headers.get("location")!)
    expect(redirect.origin).toBe("https://github.com")
    expect(redirect.searchParams.get("client_id")).toBe("test-client")
    expect(getProjectMock).toHaveBeenCalledWith("user_123", projectId)
    const saved = JSON.parse(cookieSetMock.mock.calls[0][1])
    expect(saved).toMatchObject({
      userId: "user_123",
      projectId,
      state: redirect.searchParams.get("state"),
    })
  })

  test("enabled callback validates state before connecting the repository", async () => {
    vi.stubEnv("STATIC_PLATFORM_ENABLED", "true")
    const response = await callback(
      new Request(
        `${origin}/api/github/callback?state=test-state&code=test-code`
      )
    )
    expect(response.status).toBe(302)
    expect(requestApiMock).toHaveBeenCalledWith(
      `/projects/${projectId}/github`,
      { method: "POST", clerkUserId: "user_123", body: { code: "test-code" } }
    )
    expect(response.headers.get("location")).toBe(
      `${origin}/projects/${projectId}/manage?notice=GitHub%20connected`
    )
  })

  test("enabled callback still rejects mismatched state", async () => {
    vi.stubEnv("STATIC_PLATFORM_ENABLED", "true")
    const response = await callback(
      new Request(`${origin}/api/github/callback?state=wrong&code=test-code`)
    )
    expect(response.status).toBe(400)
    expect(requestApiMock).not.toHaveBeenCalled()
  })
})
