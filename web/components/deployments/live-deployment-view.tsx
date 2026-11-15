"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, RefreshCcw } from "lucide-react"

import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { Button } from "@/components/ui/button"
import type { DeploymentLogEntry, DeploymentSnapshot } from "@/lib/types"

interface DeploymentLiveViewProps {
  projectId: string
  deploymentId: string
  initialDeployment: DeploymentSnapshot
  initialLogs: DeploymentLogEntry[]
  intervalMs?: number
}

interface DeploymentLogsPayload {
  deploymentId: string
  logs: DeploymentLogEntry[]
}

function formatDate(value: string | null) {
  if (!value) {
    return "—"
  }

  return new Date(value).toLocaleString()
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with ${response.status}`

    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) {
        message = body.error
      }
    } catch {
      // Keep fallback error message when JSON parsing fails.
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export function DeploymentLiveView({
  projectId,
  deploymentId,
  initialDeployment,
  initialLogs,
  intervalMs = 15_000,
}: DeploymentLiveViewProps) {
  const [deployment, setDeployment] = useState(initialDeployment)
  const [logs, setLogs] = useState(initialLogs)
  const [pollError, setPollError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(
    initialDeployment.updatedAt
  )

  const shouldPoll =
    deployment.status === "queued" || deployment.status === "building"

  useEffect(() => {
    if (!shouldPoll) {
      return
    }

    let isActive = true
    let timeoutId: number | null = null

    const poll = async () => {
      try {
        const [nextDeployment, nextLogs] = await Promise.all([
          fetch(`/api/deployments/${deploymentId}`, { cache: "no-store" }).then(
            parseJson<DeploymentSnapshot>
          ),
          fetch(`/api/deployments/${deploymentId}/logs?limit=200`, {
            cache: "no-store",
          }).then(parseJson<DeploymentLogsPayload>),
        ])

        if (!isActive || nextDeployment.projectId !== projectId) {
          return
        }

        setDeployment(nextDeployment)
        setLogs(nextLogs.logs)
        setLastUpdatedAt(nextDeployment.updatedAt)
        setPollError(null)
      } catch (error) {
        if (!isActive) {
          return
        }

        setPollError(
          error instanceof Error
            ? error.message
            : "Failed to refresh deployment"
        )
      } finally {
        if (isActive) {
          timeoutId = window.setTimeout(() => {
            void poll()
          }, intervalMs)
        }
      }
    }

    timeoutId = window.setTimeout(() => {
      void poll()
    }, intervalMs)

    return () => {
      isActive = false

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [deploymentId, intervalMs, projectId, shouldPoll])

  return (
    <div className="grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-12">
      <section className="min-w-0" aria-labelledby="build-output-heading">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
          <div className="flex flex-wrap items-center gap-3">
            <DeploymentStatusBadge status={deployment.status} />
            <span className="font-mono text-xs text-muted-foreground">
              {deployment.gitRef}
            </span>
          </div>
          {shouldPoll ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCcw
                className="size-3 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />{" "}
              Live updates
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Build complete
            </span>
          )}
        </div>
        {deployment.errorMessage ? (
          <p
            role="alert"
            className="mb-5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {deployment.errorMessage}
          </p>
        ) : null}
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="build-output-heading" className="text-sm font-medium">
            Logs
          </h2>
          <span className="text-xs text-muted-foreground">
            {logs.length} log lines
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-[#0f1115] text-zinc-100">
          {shouldPoll ? (
            <p className="border-b border-white/10 px-4 py-3 text-xs text-zinc-400">
              Refreshing while this deployment is still running.
            </p>
          ) : null}
          {pollError ? (
            <p
              role="alert"
              className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300"
            >
              Live updates paused: {pollError}
            </p>
          ) : null}
          {logs.length ? (
            <div
              className="max-h-[36rem] overflow-auto p-4 sm:p-5"
              aria-label="Build log output"
            >
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 py-1.5 font-mono text-xs sm:grid-cols-[28px_55px_minmax(0,1fr)]"
                >
                  <span className="text-zinc-600 select-none">
                    {log.sequence}
                  </span>
                  <span className="hidden text-[10px] text-zinc-500 uppercase sm:block">
                    {log.stream}
                  </span>
                  <span className="leading-relaxed break-all whitespace-pre-wrap">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-14">
              <h3 className="text-sm font-medium">No logs yet</h3>
              <p className="mt-2 text-xs leading-6 text-zinc-400">
                Build output will appear here as the deployment progresses.
              </p>
            </div>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Last update {formatDate(lastUpdatedAt)}
        </p>
      </section>
      <aside
        className="min-w-0 xl:border-l xl:border-border xl:pl-7"
        aria-label="Deployment details"
      >
        <h2 className="text-sm font-medium">Deployment details</h2>
        <dl className="mt-6 space-y-6 text-xs">
          <div>
            <dt className="text-muted-foreground">Commit</dt>
            <dd className="mt-2 font-mono break-all">
              {deployment.commitSha ?? "Not resolved yet"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deployment ID</dt>
            <dd className="mt-2 font-mono break-all">{deployment.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="mt-2">{formatDate(deployment.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Build started</dt>
            <dd className="mt-2">{formatDate(deployment.buildStartedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Build finished</dt>
            <dd className="mt-2">{formatDate(deployment.buildFinishedAt)}</dd>
          </div>
          {deployment.artifactUrl ? (
            <div>
              <dt className="text-muted-foreground">Artifacts</dt>
              <dd className="mt-2">
                <Link
                  href={deployment.artifactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  Open artifacts{" "}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-7 flex flex-wrap gap-2 border-t border-border pt-5">
          {deployment.previewUrl ? (
            <Button asChild size="sm">
              <Link
                href={deployment.previewUrl}
                target="_blank"
                rel="noreferrer"
              >
                Preview deployment <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${projectId}`}>Open project</Link>
          </Button>
        </div>
      </aside>
    </div>
  )
}
