import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { useFormStatusMock } = vi.hoisted(() => ({
  useFormStatusMock: vi.fn(),
}))

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>()
  return {
    ...actual,
    useFormStatus: useFormStatusMock,
  }
})

import { SubmitButton } from "./submit-button"

describe("SubmitButton", () => {
  beforeEach(() => {
    useFormStatusMock.mockReset()
  })

  test("renders default children and enabled state when idle", () => {
    useFormStatusMock.mockReturnValue({ pending: false })

    render(<SubmitButton pendingText="Deploying…">Deploy now</SubmitButton>)

    const button = screen.getByRole("button", { name: "Deploy now" })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute("aria-busy")
  })

  test("disables button and shows pendingText while form submission is pending", () => {
    useFormStatusMock.mockReturnValue({ pending: true })

    render(<SubmitButton pendingText="Deploying…">Deploy now</SubmitButton>)

    const button = screen.getByRole("button", { name: "Deploying…" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
  })
})
