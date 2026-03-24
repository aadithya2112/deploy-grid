import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { ProjectCreateFields } from "./project-create-fields"

describe("ProjectCreateFields", () => {
  test("hides advanced settings by default and reveals them on demand", async () => {
    render(<ProjectCreateFields />)

    expect(screen.getByLabelText("GitHub URL")).toBeInTheDocument()
    expect(screen.queryByLabelText("Root directory")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /advanced settings/i }))

    expect(await screen.findByLabelText("Root directory")).toBeInTheDocument()
    expect(screen.getByLabelText("Build command")).toBeInTheDocument()
  })
})
