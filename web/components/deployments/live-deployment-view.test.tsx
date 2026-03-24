import type React from "react"
import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import type { DeploymentLogEntry, DeploymentSnapshot } from "@/lib/types"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

import { DeploymentLiveView } from "./live-deployment-view"

const initialDeployment: DeploymentSnapshot = {
  id: "deployment-123",
  projectId: "project-123",
  repoUrl: "https://github.com/acme/demo.git",
  gitRef: "main",
  status: "building",
  commitSha: null,
  previewUrl: null,
  artifactUrl: null,
  buildStartedAt: "2025-01-01T00:00:00.000Z",
  buildFinishedAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  errorMessage: null,
}

const initialLogs: DeploymentLogEntry[] = [
  {
    id: "log-1",
    deploymentId: "deployment-123",
    stream: "system",
    sequence: 1,
    message: "repository cloned",
    createdAt: "2025-01-01T00:00:00.000Z",
  },
]

describe("DeploymentLiveView", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test("polls deployment state and logs while the deployment is active", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...initialDeployment,
            status: "ready",
            commitSha: "abc123",
            updatedAt: "2025-01-01T00:01:00.000Z",
            buildFinishedAt: "2025-01-01T00:01:00.000Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            deploymentId: "deployment-123",
            logs: [
              ...initialLogs,
              {
                id: "log-2",
                deploymentId: "deployment-123",
                stream: "stdout",
                sequence: 2,
                message: "build finished",
                createdAt: "2025-01-01T00:01:00.000Z",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )

    render(
      <DeploymentLiveView
        projectId="project-123"
        deploymentId="deployment-123"
        initialDeployment={initialDeployment}
        initialLogs={initialLogs}
        intervalMs={500}
      />
    )

    expect(
      screen.getByText("Refreshing while this deployment is still running.")
    ).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByText("abc123")).toBeInTheDocument()
    expect(screen.getByText("build finished")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/deployments/deployment-123",
      { cache: "no-store" }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/deployments/deployment-123/logs?limit=200",
      { cache: "no-store" }
    )
  })

  test("shows a polling error when live updates fail", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "upstream unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "upstream unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        })
      )

    render(
      <DeploymentLiveView
        projectId="project-123"
        deploymentId="deployment-123"
        initialDeployment={initialDeployment}
        initialLogs={initialLogs}
        intervalMs={500}
      />
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(
      screen.getByText("Live updates paused: upstream unavailable")
    ).toBeInTheDocument()
  })
})
