"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Clock,
  ExternalLink,
  GitBranch,
  RotateCcw,
  Search,
} from "lucide-react"

import { redeployDeploymentAction } from "@/app/projects/actions"
import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
import { SubmitButton } from "@/components/ui/submit-button"
import {
  formatBuildDuration,
  formatShortTimestamp,
  getDeploymentLiveUrl,
} from "@/lib/deployment-format"
import type { DeploymentSnapshot } from "@/lib/types"
import { cn } from "@/lib/utils"

type FilterKey = "all" | "ready" | "active" | "failed"

interface DeploymentsPanelProps {
  projectId: string
  deployments: DeploymentSnapshot[]
  liveDeploymentId: string | null
  hasMore: boolean
}

function matchesFilter(deployment: DeploymentSnapshot, filter: FilterKey) {
  if (filter === "all") return true
  if (filter === "ready") return deployment.status === "ready"
  if (filter === "active") {
    return deployment.status === "queued" || deployment.status === "building"
  }
  return deployment.status === "failed" || deployment.status === "cancelled"
}

export function DeploymentsPanel({
  projectId,
  deployments,
  liveDeploymentId,
  hasMore,
}: DeploymentsPanelProps) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")

  const counts = useMemo(() => {
    let ready = 0
    let active = 0
    let failed = 0
    for (const deployment of deployments) {
      if (deployment.status === "ready") ready += 1
      else if (
        deployment.status === "queued" ||
        deployment.status === "building"
      ) {
        active += 1
      } else {
        failed += 1
      }
    }
    return { all: deployments.length, ready, active, failed }
  }, [deployments])

  const filteredDeployments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return deployments.filter((deployment) => {
      if (!matchesFilter(deployment, filter)) return false
      if (!query) return true
      const haystack = [
        deployment.id,
        deployment.commitSha ?? "",
        deployment.gitRef,
        deployment.status,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [deployments, filter, search])

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "ready", label: "Ready", count: counts.ready },
    { key: "active", label: "In progress", count: counts.active },
    { key: "failed", label: "Failed", count: counts.failed },
  ]

  return (
    <section
      id="deployments"
      aria-labelledby="deployments-heading"
      className="min-w-0 scroll-mt-20 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2
            id="deployments-heading"
            className="font-heading text-sm font-semibold tracking-tight"
          >
            Recent deployments
          </h2>
          <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {deployments.length} {deployments.length === 1 ? "build" : "builds"}
          </span>
        </div>
        {hasMore ? (
          <span className="text-xs text-muted-foreground">
            Showing latest {deployments.length}
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {deployments.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5 sm:px-5">
            <div
              role="tablist"
              aria-label="Filter deployments by status"
              className="flex flex-wrap items-center gap-1"
            >
              {filterTabs.map((tab) => {
                const selected = filter === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {deployments.length > 1 ? (
              <div className="relative w-full sm:w-52">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter branch or commit…"
                  aria-label="Filter deployments by branch or commit"
                  className="h-7 bg-background pl-8 text-xs"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {filteredDeployments.length > 0 ? (
          <ul className="divide-y divide-border">
            {filteredDeployments.map((deployment) => {
              const liveUrl =
                deployment.status === "ready"
                  ? getDeploymentLiveUrl(deployment)
                  : null
              const isCurrentLive = deployment.id === liveDeploymentId
              const duration = formatBuildDuration(
                deployment.buildStartedAt,
                deployment.buildFinishedAt,
                deployment.status
              )
              const shortRef =
                deployment.commitSha?.slice(0, 8) ?? deployment.id.slice(0, 8)

              return (
                <li
                  key={deployment.id}
                  className="px-4 py-4 transition-colors hover:bg-muted/25 sm:px-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <DeploymentStatusBadge status={deployment.status} />
                        {isCurrentLive ? (
                          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary dark:text-chart-2">
                            Current
                          </span>
                        ) : null}
                        <Link
                          href={`/projects/${projectId}/deployments/${deployment.id}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-foreground underline-offset-4 hover:text-primary hover:underline dark:hover:text-chart-2"
                          aria-label={`Open deployment ${deployment.id.slice(0, 8)}`}
                        >
                          <span>{shortRef}</span>
                          <LinkPendingIndicator />
                        </Link>
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          <GitBranch className="size-2.5" aria-hidden="true" />
                          {deployment.gitRef}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="size-3" aria-hidden="true" />
                          {duration}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={deployment.createdAt}>
                          {formatShortTimestamp(deployment.createdAt)}
                        </time>
                      </div>

                      {deployment.errorMessage ? (
                        <p className="flex items-start gap-1.5 pt-0.5 text-xs text-destructive">
                          <AlertCircle
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="line-clamp-2 break-words">
                            {deployment.errorMessage}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {liveUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={liveUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Visit site for ${shortRef}`}
                          >
                            <span>Visit</span>
                            <ExternalLink
                              className="size-3"
                              aria-hidden="true"
                            />
                          </a>
                        </Button>
                      ) : null}

                      <form action={redeployDeploymentAction}>
                        <input
                          type="hidden"
                          name="projectId"
                          value={projectId}
                        />
                        <input
                          type="hidden"
                          name="deploymentId"
                          value={deployment.id}
                        />
                        <SubmitButton
                          size="sm"
                          variant="ghost"
                          pendingText="Redeploying…"
                          aria-label={`Redeploy ${shortRef}`}
                        >
                          <RotateCcw className="size-3" aria-hidden="true" />
                          <span>Redeploy</span>
                        </SubmitButton>
                      </form>

                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/projects/${projectId}/deployments/${deployment.id}`}
                        >
                          <span>Logs</span>
                          <LinkPendingIndicator
                            fallback={
                              <ArrowRight
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            }
                          />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : deployments.length > 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No deployments match the current filter.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setFilter("all")
                setSearch("")
              }}
            >
              Reset filters
            </Button>
          </div>
        ) : (
          <p className="px-5 py-10 text-sm text-muted-foreground">
            Your build history will appear here after the first deployment.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Select any deployment to inspect full build output, or redeploy a
        previous commit in one click.
      </p>
    </section>
  )
}
