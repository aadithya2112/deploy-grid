"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, FolderGit2, RefreshCcw } from "lucide-react"

import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
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
  intervalMs = 2000,
}: DeploymentLiveViewProps) {
  const [deployment, setDeployment] = useState(initialDeployment)
  const [logs, setLogs] = useState(initialLogs)
  const [pollError, setPollError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialDeployment.updatedAt)

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
          error instanceof Error ? error.message : "Failed to refresh deployment"
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
    <>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,252,0.92))] dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.9),rgba(15,23,42,0.86))]">
            <div className="border-b border-border/70 px-5 py-5 md:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3">
                  <FolderGit2 className="size-3" />
                  Deployment
                </Badge>
                <DeploymentStatusBadge status={deployment.status} />
                {shouldPoll ? (
                  <Badge variant="outline" className="rounded-full px-3 text-muted-foreground">
                    <RefreshCcw className="size-3 animate-spin" />
                    Live polling
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
                {deployment.repoUrl}
              </h2>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Deployment ID {deployment.id}
              </p>
            </div>

            <div className="grid gap-3 px-5 py-5 text-sm md:grid-cols-2 md:px-6">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Commit SHA
                </p>
                <p className="mt-2 font-mono text-xs text-foreground">
                  {deployment.commitSha ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Git ref
                </p>
                <p className="mt-2 font-mono text-xs text-foreground">
                  {deployment.gitRef}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Created
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {formatDate(deployment.createdAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Last update
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {formatDate(lastUpdatedAt)}
                </p>
              </div>
            </div>
            {deployment.errorMessage ? (
              <div className="border-t border-destructive/20 bg-destructive/5 px-5 py-4 md:px-6">
                <p className="text-sm text-destructive">{deployment.errorMessage}</p>
              </div>
            ) : null}
          </div>

          <Card className="overflow-hidden rounded-[24px] border-border/70 bg-[#0f1115] text-zinc-100 shadow-none">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white">Logs</CardTitle>
              <CardDescription className="text-zinc-400">
                Latest {logs.length} log lines from /deployments/:id/logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {shouldPoll ? (
                <div className="border-b border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-zinc-400">
                  Refreshing while this deployment is still running.
                </div>
              ) : null}
              {pollError ? (
                <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300">
                  Live updates paused: {pollError}
                </div>
              ) : null}
              {logs.length === 0 ? (
                <div className="p-5">
                  <Empty className="border border-white/10 bg-white/[0.03]">
                    <EmptyHeader>
                      <EmptyTitle className="text-white">No logs yet</EmptyTitle>
                      <EmptyDescription className="text-zinc-400">
                        Queue and worker activity logs will appear as the deployment
                        progresses.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <div className="max-h-[34rem] overflow-auto px-4 py-4 font-mono text-xs">
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="grid gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 md:grid-cols-[auto_auto_1fr]"
                      >
                        <span className="text-zinc-500">#{log.sequence}</span>
                        <span className="w-fit rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                          {log.stream}
                        </span>
                        <span className="leading-relaxed text-zinc-100 wrap-break-word whitespace-pre-wrap">
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Project</CardTitle>
              <CardDescription>
                Navigate back to the project-level workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full rounded-full" variant="outline">
                <Link href={`/projects/${projectId}`}>Open project</Link>
              </Button>
              {deployment.previewUrl ? (
                <Button asChild className="w-full rounded-full" variant="secondary">
                  <Link href={deployment.previewUrl} target="_blank">
                    Preview deployment
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Runtime metadata</CardTitle>
              <CardDescription>
                Details used while the worker is processing this build.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Build started</dt>
                  <dd className="mt-2 font-medium text-foreground">
                    {formatDate(deployment.buildStartedAt)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Build finished</dt>
                  <dd className="mt-2 font-medium text-foreground">
                    {formatDate(deployment.buildFinishedAt)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Preview URL</dt>
                  <dd className="mt-2 truncate font-medium text-foreground">
                    {deployment.previewUrl ? (
                      <Link
                        href={deployment.previewUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                      >
                        <span className="truncate">{deployment.previewUrl}</span>
                        <ExternalLink className="size-3.5" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Artifact URL</dt>
                  <dd className="mt-2 truncate font-medium text-foreground">
                    {deployment.artifactUrl ? (
                      <Link
                        href={deployment.artifactUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                      >
                        <span className="truncate">{deployment.artifactUrl}</span>
                        <ExternalLink className="size-3.5" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}
