import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  refreshMock,
  resetNavigationMocks,
  useRouterMock,
} from "@/tests/support/navigation"

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}))

import { RefreshButton } from "./refresh-button"

describe("RefreshButton", () => {
  beforeEach(() => {
    resetNavigationMocks()
  })

  test("calls router.refresh when clicked", () => {
    render(<RefreshButton />)

    const button = screen.getByRole("button", { name: "Refresh" })
    fireEvent.click(button)

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
