import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  redirectMock,
  resetNavigationMocks,
} from "@/tests/support/navigation"
import { renderServerComponent } from "@/tests/support/server-component"

const {
  getAuthMock,
  listProjectsMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  listProjectsMock: vi.fn(),
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

vi.mock("@/components/dashboard/api-health-card", () => ({
  ApiHealthCard: () => null,
}))

vi.mock("@/lib/api", () => ({
  listProjects: listProjectsMock,
}))

import DashboardPage from "./page"

describe("DashboardPage", () => {
  beforeEach(() => {
    resetNavigationMocks()
    getAuthMock.mockReset()
    listProjectsMock.mockReset()

    getAuthMock.mockResolvedValue({ userId: "user_123" })
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
    listProjectsMock.mockRejectedValueOnce(new Error("Projects offline"))

    await renderServerComponent(DashboardPage({}))

    expect(screen.getByText("Projects offline")).toBeInTheDocument()
  })
})
