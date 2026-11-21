import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  pushMock,
  resetNavigationMocks,
  useRouterMock,
} from "@/tests/support/navigation"

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}))

import { ProjectSearchForm } from "./project-search-form"

describe("ProjectSearchForm", () => {
  beforeEach(() => {
    resetNavigationMocks()
  })

  test("navigates with trimmed query when submitted", () => {
    render(<ProjectSearchForm initialQuery="" />)

    fireEvent.change(screen.getByRole("searchbox", { name: "Find a project" }), {
      target: { value: "  Ready App  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))

    expect(pushMock).toHaveBeenCalledWith("/dashboard?query=Ready+App")
  })

  test("clears the active search query when Clear is clicked", () => {
    render(<ProjectSearchForm initialQuery="Ready App" />)

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))

    expect(pushMock).toHaveBeenCalledWith("/dashboard")
  })
})
