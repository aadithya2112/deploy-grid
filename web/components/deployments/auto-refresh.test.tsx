import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  refreshMock,
  resetNavigationMocks,
  useRouterMock,
} from "@/tests/support/navigation"

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}))

import { DeploymentAutoRefresh } from "./auto-refresh"

describe("DeploymentAutoRefresh", () => {
  beforeEach(() => {
    resetNavigationMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("refreshes the router when enabled", () => {
    render(<DeploymentAutoRefresh enabled />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  test("does nothing when disabled", () => {
    render(<DeploymentAutoRefresh enabled={false} />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(refreshMock).not.toHaveBeenCalled()
  })

  test("clears the timer on unmount", () => {
    const { unmount } = render(<DeploymentAutoRefresh enabled intervalMs={500} />)

    unmount()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(refreshMock).not.toHaveBeenCalled()
  })
})
