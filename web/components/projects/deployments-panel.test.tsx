import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

vi.mock("@/app/projects/actions", () => ({
  redeployDeploymentAction: vi.fn(),
}))

import type { DeploymentSnapshot } from "@/lib/types"
import { DeploymentsPanel } from "./deployments-panel"

const deployments: DeploymentSnapshot[] = [
  {
    id: "dep-failed-1",
    projectId: "proj-1",
    repoUrl: "https://github.com/acme/app.git",
    gitRef: "feat/checkout",
    status: "failed",
    commitSha: "deadbeef1234",
    previewUrl: null,
    artifactUrl: null,
    buildStartedAt: "2025-01-02T00:00:00.000Z",
    buildFinishedAt: "2025-01-02T00:00:14.000Z",
    createdAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:14.000Z",
    errorMessage: "TypeScript compile error",
  },
  {
    id: "dep-ready-1",
    projectId: "proj-1",
    repoUrl: "https://github.com/acme/app.git",
    gitRef: "main",
    status: "ready",
    commitSha: "abc123456789",
    previewUrl: "https://app.deploygrid.app",
    artifactUrl: null,
    buildStartedAt: "2025-01-01T00:00:00.000Z",
    buildFinishedAt: "2025-01-01T00:00:22.000Z",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:22.000Z",
    errorMessage: null,
  },
]

describe("DeploymentsPanel", () => {
  test("filters deployments by status tab and branch search", () => {
    render(
      <DeploymentsPanel
        projectId="proj-1"
        deployments={deployments}
        liveDeploymentId="dep-ready-1"
        hasMore={false}
      />
    )

    expect(screen.getByText("TypeScript compile error")).toBeInTheDocument()
    expect(screen.getByText("Current")).toBeInTheDocument()
    expect(screen.getByText("22s")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: /ready/i }))
    expect(screen.queryByText("TypeScript compile error")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /visit site for abc12345/i })).toHaveAttribute(
      "href",
      "https://app.deploygrid.app"
    )

    fireEvent.click(screen.getByRole("tab", { name: /all/i }))
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Filter deployments by branch or commit",
      }),
      { target: { value: "checkout" } }
    )
    expect(screen.getByText("deadbeef")).toBeInTheDocument()
    expect(screen.queryByText("abc12345")).not.toBeInTheDocument()
  })
})
