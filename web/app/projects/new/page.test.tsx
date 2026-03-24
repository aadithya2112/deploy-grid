import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  redirectMock,
  resetNavigationMocks,
} from "@/tests/support/navigation"
import { renderServerComponent } from "@/tests/support/server-component"

const { getAuthMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

vi.mock("@/lib/auth", () => ({
  getAuth: getAuthMock,
}))

vi.mock("@/app/projects/actions", () => ({
  createProjectAndDeployAction: vi.fn(),
}))

import NewProjectPage from "./page"

describe("NewProjectPage", () => {
  beforeEach(() => {
    resetNavigationMocks()
    getAuthMock.mockReset()
    getAuthMock.mockResolvedValue({ userId: "user_123" })
  })

  test("redirects signed-out users to sign-in", async () => {
    getAuthMock.mockResolvedValueOnce({ userId: null })

    await expect(NewProjectPage()).rejects.toMatchObject({
      location: "/sign-in",
    })
  })

  test("renders the dedicated create-and-deploy route", async () => {
    await renderServerComponent(NewProjectPage())

    expect(screen.getByText("New Project")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /create and deploy/i })
    ).toBeInTheDocument()
    expect(screen.getByText("What happens next")).toBeInTheDocument()
  })
})
