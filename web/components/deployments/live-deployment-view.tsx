"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, GitBranch, RefreshCcw, Terminal } from "lucide-react"

import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { Button } from "@/components/ui/button"
import type { DeploymentLogEntry, DeploymentSnapshot } from "@/lib/types"
import { cn } from "@/lib/utils"

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
  const [isFetching, setIsFetching] = useState(false)
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
      if (isActive) {
        setIsFetching(true)
      }

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
          setIsFetching(false)
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
    <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 space-y-4" aria-labelledby="build-output-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <DeploymentStatusBadge status={deployment.status} />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
              <GitBranch className="size-3" aria-hidden="true" />
              {deployment.gitRef}
            </span>
          </div>
          {shouldPoll ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCcw
                className={cn(
                  "size-3.5 text-primary dark:text-chart-2",
                  isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : "animate-pulse motion-reduce:animate-none"
                )}
                aria-hidden="true"
              />
              {isFetching ? "Syncing logs…" : "Live updates"}
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
            className="rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
          >
            {deployment.errorMessage}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-[#0f1115] text-zinc-100 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.5)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal
                className="size-3.5 text-zinc-400"
                aria-hidden="true"
              />
              <h2
                id="build-output-heading"
                className="font-heading text-xs font-medium text-zinc-200"
              >
                Logs
              </h2>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              {logs.length} log lines
            </span>
          </div>

          {shouldPoll ? (
            <p className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-zinc-400">
              <span
                className="size-1.5 animate-pulse rounded-full bg-sky-400 motion-reduce:animate-none"
                aria-hidden="true"
              />
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
                  className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 py-1 font-mono text-xs sm:grid-cols-[28px_58px_minmax(0,1fr)]"
                >
                  <span className="text-zinc-600 select-none">
                    {log.sequence}
                  </span>
                  <span
                    className={cn(
                      "hidden text-[10px] uppercase sm:block",
                      log.stream === "stderr"
                        ? "text-rose-400"
                        : log.stream === "system"
                          ? "text-teal-400"
                          : "text-zinc-500"
                    )}
                  >
                    {log.stream}
                  </span>
                  <span className="leading-relaxed break-all whitespace-pre-wrap text-zinc-200">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-14 text-center">
              <h3 className="text-sm font-medium text-zinc-200">No logs yet</h3>
              <p className="mt-2 text-xs leading-6 text-zinc-400">
                Build output will appear here as the deployment progresses.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Last update {formatDate(lastUpdatedAt)}
        </p>
      </section>

      <aside
        className="min-w-0 rounded-xl border border-border bg-card p-5"
        aria-label="Deployment details"
      >
        <h2 className="border-b border-border pb-3.5 font-heading text-sm font-semibold tracking-tight">
          Deployment details
        </h2>
        <dl className="divide-y divide-border/70 text-xs">
          <div className="py-3">
            <dt className="text-[11px] text-muted-foreground">Commit</dt>
            <dd className="mt-1 font-mono break-all text-foreground">
              {deployment.commitSha ?? "Not resolved yet"}
            </dd>
          </div>
          <div className="py-3">
            <dt className="text-[11px] text-muted-foreground">Deployment ID</dt>
            <dd className="mt-1 font-mono break-all text-foreground">
              {deployment.id}
            </dd>
          </div>
          <div className="py-3">
            <dt className="text-[11px] text-muted-foreground">Created</dt>
            <dd className="mt-1 text-foreground">
              {formatDate(deployment.createdAt)}
            </dd>
          </div>
          <div className="py-3">
            <dt className="text-[11px] text-muted-foreground">Build started</dt>
            <dd className="mt-1 text-foreground">
              {formatDate(deployment.buildStartedAt)}
            </dd>
          </div>
          <div className="py-3">
            <dt className="text-[11px] text-muted-foreground">
              Build finished
            </dt>
            <dd className="mt-1 text-foreground">
              {formatDate(deployment.buildFinishedAt)}
            </dd>
          </div>
          {deployment.artifactUrl ? (
            <div className="py-3">
              <dt className="text-[11px] text-muted-foreground">Artifacts</dt>
              <dd className="mt-1">
                <Link
                  href={deployment.artifactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline dark:text-chart-2"
                >
                  Open artifacts
                  <ExternalLink className="size-3" aria-hidden="true" />
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {deployment.previewUrl ? (
            <Button asChild size="sm" className="w-full">
              <Link
                href={deployment.previewUrl}
                target="_blank"
                rel="noreferrer"
              >
                Preview deployment
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/projects/${projectId}`}>Open project</Link>
          </Button>
        </div>
      </aside>
    </div>
  )
}
