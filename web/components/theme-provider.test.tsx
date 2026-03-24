import { render } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

const setThemeMock = vi.fn()

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: setThemeMock,
  }),
}))

import { ThemeProvider } from "./theme-provider"

describe("ThemeProvider", () => {
  beforeEach(() => {
    setThemeMock.mockReset()
  })

  test("ignores keydown events when key is missing", () => {
    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>
    )

    const event = new Event("keydown")
    Object.defineProperty(event, "key", {
      value: undefined,
    })

    expect(() => {
      window.dispatchEvent(event)
    }).not.toThrow()
    expect(setThemeMock).not.toHaveBeenCalled()
  })

  test("toggles the theme with the d hotkey", () => {
    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>
    )

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }))

    expect(setThemeMock).toHaveBeenCalledWith("dark")
  })
})
