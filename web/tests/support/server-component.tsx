import type React from "react"
import { render } from "@testing-library/react"

export async function renderServerComponent(
  component: Promise<React.ReactElement> | React.ReactElement
) {
  return render(await component)
}
