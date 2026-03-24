import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  redirectMock,
  resetNavigationMocks,
} from "@/tests/support/navigation"
import { renderServerComponent } from "@/tests/support/server-component"

const {
  getAuthMock,
  getHealthMock,
  listProjectsMock,
  getApiBaseUrlForUiMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getHealthMock: vi.fn(),
  listProjectsMock: vi.fn(),
  getApiBaseUrlForUiMock: vi.fn(() => "http://127.0.0.1:3000"),
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

vi.mock("@/lib/auth", () => ({
  getAuth: getAuthMock,
}))

vi.mock("@/lib/test-mode", () => ({
  isE2ETestMode: () => false,
}))

vi.mock("@/lib/api", () => ({
  getHealth: getHealthMock,
  listProjects: listProjectsMock,
  getApiBaseUrlForUi: getApiBaseUrlForUiMock,
}))

import DashboardPage from "./page"

describe("DashboardPage", () => {
  beforeEach(() => {
    resetNavigationMocks()
    getAuthMock.mockReset()
    getHealthMock.mockReset()
    listProjectsMock.mockReset()
    getApiBaseUrlForUiMock.mockClear()

    getAuthMock.mockResolvedValue({ userId: "user_123" })
    getHealthMock.mockResolvedValue({ status: "ok", database: "ok" })
    listProjectsMock.mockResolvedValue({
      projects: [
        {
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
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
      ],
      pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
    })
  })

  test("redirects signed-out users to sign-in", async () => {
    getAuthMock.mockResolvedValueOnce({ userId: null })

    await expect(DashboardPage({})).rejects.toMatchObject({
      location: "/sign-in",
    })
    expect(redirectMock).toHaveBeenCalledWith("/sign-in")
  })

  test("renders a projects-first workspace and not the create form", async () => {
    await renderServerComponent(DashboardPage({}))

    expect(screen.getByText("Your projects")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /new project/i })).toBeInTheDocument()
    expect(screen.getByText("Demo App")).toBeInTheDocument()
    expect(screen.queryByLabelText("GitHub URL")).not.toBeInTheDocument()
  })

  test("passes the dashboard query through to project listing", async () => {
    await renderServerComponent(
      DashboardPage({
        searchParams: Promise.resolve({ query: "demo" }),
      })
    )

    expect(listProjectsMock).toHaveBeenCalledWith("user_123", {
      limit: 20,
      query: "demo",
    })
  })

  test("shows the empty-state CTA when there are no projects", async () => {
    listProjectsMock.mockResolvedValueOnce({
      projects: [],
      pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
    })

    await renderServerComponent(DashboardPage({}))

    expect(screen.getByText("No projects yet")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /new project/i })[0]).toHaveAttribute(
      "href",
      "/projects/new"
    )
  })

  test("renders fallback UI when health and projects fail", async () => {
    getHealthMock.mockRejectedValueOnce(new Error("Health offline"))
    listProjectsMock.mockRejectedValueOnce(new Error("Projects offline"))

    await renderServerComponent(DashboardPage({}))

    expect(screen.getByText("Health offline")).toBeInTheDocument()
    expect(screen.getByText("Projects offline")).toBeInTheDocument()
  })
})
