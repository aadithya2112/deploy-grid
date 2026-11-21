import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Clock,
  ExternalLink,
  GitBranch,
  Layers,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react"

import {
  deployProjectAction,
  redeployDeploymentAction,
} from "@/app/projects/actions"
import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { PageShell } from "@/components/layout/page-shell"
import { RefreshButton } from "@/components/layout/refresh-button"
import { DeployRefDialog } from "@/components/projects/deploy-ref-dialog"
import { DeploymentsPanel } from "@/components/projects/deployments-panel"
import { ProjectEnvVarsCard } from "@/components/projects/project-env-vars-card"
import { ProjectSettingsCard } from "@/components/projects/project-settings-card"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
import { SubmitButton } from "@/components/ui/submit-button"
import {
  ApiRequestError,
  getProject,
  listProjectDeployments,
  listProjectEnvVars,
} from "@/lib/api"
import { getAuth } from "@/lib/auth"
import {
  formatBuildDuration,
  formatShortTimestamp,
  getDeploymentLiveUrl,
} from "@/lib/deployment-format"
import { isStaticPlatformEnabled } from "@/lib/static-platform"

function normalizeNotice(input: string | string[] | undefined) {
  return typeof input === "string" && input.trim().length > 0
    ? input.trim()
    : null
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ notice?: string | string[] }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const notice = normalizeNotice(resolvedSearchParams?.notice)

  const { userId } = await getAuth()
  if (!userId) redirect("/sign-in")

  let project
  try {
    project = await getProject(userId, id)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound()
    throw error
  }

  const [deploymentsResult, envVarsResult] = await Promise.all([
    listProjectDeployments(userId, id, { limit: 20 }),
    listProjectEnvVars(userId, id),
  ])

  const deployments = deploymentsResult.deployments
  const latestDeployment = deployments[0] ?? null
  const latestReadyDeployment =
    deployments.find((deployment) => deployment.status === "ready") ?? null

  const showSeparateLatestBanner = Boolean(
    latestDeployment &&
      latestReadyDeployment &&
      latestDeployment.id !== latestReadyDeployment.id
  )
  const featuredDeployment = latestReadyDeployment ?? latestDeployment
  const featuredLiveUrl =
    featuredDeployment?.status === "ready"
      ? getDeploymentLiveUrl(featuredDeployment)
      : null

  return (
    <PageShell
      title={project.name}
      description="Live status, deployment history, build settings, and environment variables."
      section="project"
      project={{ id, name: project.name }}
      actions={
        <>
          <RefreshButton variant="outline" />
          <DeployRefDialog
            projectId={id}
            defaultBranch={project.defaultBranch}
          />
          {isStaticPlatformEnabled() ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${id}/manage`}>
                <Layers className="size-3.5" aria-hidden="true" />
                <span>Manage releases</span>
                <LinkPendingIndicator />
              </Link>
            </Button>
          ) : null}
          <form action={deployProjectAction}>
            <input type="hidden" name="projectId" value={id} />
            <input
              type="hidden"
              name="gitRef"
              value={latestDeployment?.gitRef ?? project.defaultBranch}
            />
            <SubmitButton
              size="sm"
              pendingText={
                latestDeployment ? "Starting redeploy…" : "Starting deploy…"
              }
            >
              <Play className="size-3.5" aria-hidden="true" />
              <span>{latestDeployment ? "Redeploy latest" : "Deploy now"}</span>
            </SubmitButton>
          </form>
        </>
      }
    >
      <div className="space-y-7">
        {notice ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-foreground"
          >
            <span>{notice}</span>
            <Link
              href={`/projects/${id}`}
              className="text-xs font-medium text-primary hover:underline dark:text-chart-2"
            >
              Dismiss
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <Link
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-foreground transition-colors hover:border-primary/40 hover:text-primary dark:hover:text-chart-2"
          >
            <span className="break-all">
              {project.repoUrl
                .replace(/^https?:\/\/github\.com\//, "")
                .replace(/\.git$/, "")}
            </span>
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono">
            <GitBranch className="size-3" aria-hidden="true" />
            {project.defaultBranch}
          </span>
        </div>

        {showSeparateLatestBanner && latestDeployment ? (
          <div
            role={latestDeployment.status === "failed" ? "alert" : "status"}
            className={
              latestDeployment.status === "failed"
                ? "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/6 px-5 py-4"
                : "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-500/25 bg-sky-500/8 px-5 py-4"
            }
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                {latestDeployment.status === "failed" ? (
                  <AlertCircle
                    className="size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                ) : (
                  <Loader2
                    className="size-4 shrink-0 animate-spin text-sky-600 motion-reduce:animate-none dark:text-sky-400"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {latestDeployment.status === "failed"
                    ? `Latest build on ${latestDeployment.gitRef} failed`
                    : latestDeployment.status === "cancelled"
                      ? `Latest build on ${latestDeployment.gitRef} was cancelled`
                      : `New build on ${latestDeployment.gitRef} is ${latestDeployment.status}`}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  (
                  {latestDeployment.commitSha?.slice(0, 8) ??
                    latestDeployment.id.slice(0, 8)}
                  )
                </span>
              </div>
              {latestDeployment.errorMessage ? (
                <p className="text-xs text-destructive">
                  {latestDeployment.errorMessage}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your previous live deployment below remains active until a
                  newer build succeeds.
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {latestDeployment.status === "failed" ? (
                <form action={redeployDeploymentAction}>
                  <input type="hidden" name="projectId" value={id} />
                  <input
                    type="hidden"
                    name="deploymentId"
                    value={latestDeployment.id}
                  />
                  <SubmitButton
                    size="sm"
                    variant="outline"
                    pendingText="Retrying…"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    <span>Retry build</span>
                  </SubmitButton>
                </form>
              ) : null}
              <Button asChild size="sm" variant="secondary">
                <Link
                  href={`/projects/${id}/deployments/${latestDeployment.id}`}
                >
                  <span>
                    {latestDeployment.status === "failed"
                      ? "Inspect error logs"
                      : "Watch live logs"}
                  </span>
                  <LinkPendingIndicator
                    fallback={<ArrowRight className="size-3.5" aria-hidden="true" />}
                  />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        <section
          aria-labelledby="latest-heading"
          className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.25)] sm:p-6"
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 bg-primary dark:bg-chart-2"
          />
          <div className="flex flex-wrap items-start justify-between gap-5 pl-2">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2
                  id="latest-heading"
                  className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  Latest deployment
                </h2>
                {featuredDeployment ? (
                  <DeploymentStatusBadge status={featuredDeployment.status} />
                ) : null}
                {showSeparateLatestBanner && latestReadyDeployment ? (
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary dark:text-chart-2">
                    Currently live
                  </span>
                ) : null}
              </div>

              {featuredDeployment ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/projects/${id}/deployments/${featuredDeployment.id}`}
                      className="group inline-flex items-center gap-2 font-heading text-lg font-semibold transition-colors hover:text-primary dark:hover:text-chart-2"
                    >
                      <span className="font-mono">
                        {featuredDeployment.commitSha
                          ? featuredDeployment.commitSha.slice(0, 8)
                          : featuredDeployment.id.slice(0, 8)}
                      </span>
                      <LinkPendingIndicator
                        fallback={
                          <ArrowRight
                            className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                            aria-hidden="true"
                          />
                        }
                      />
                    </Link>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      <GitBranch className="size-3" aria-hidden="true" />
                      {featuredDeployment.gitRef}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="size-3" aria-hidden="true" />
                      {formatBuildDuration(
                        featuredDeployment.buildStartedAt,
                        featuredDeployment.buildFinishedAt,
                        featuredDeployment.status
                      )}
                    </span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={featuredDeployment.createdAt}>
                      {formatShortTimestamp(featuredDeployment.createdAt)}
                    </time>
                  </div>

                  {featuredLiveUrl ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={featuredLiveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:border-primary/40 hover:text-primary dark:hover:text-chart-2"
                      >
                        <span className="truncate">
                          {featuredLiveUrl.replace(/^https?:\/\//, "")}
                        </span>
                        <ExternalLink
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                      </a>
                      <CopyButton
                        value={featuredLiveUrl}
                        label="Copy URL"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                      />
                    </div>
                  ) : null}

                  {featuredDeployment.errorMessage ? (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/6 px-3 py-2 text-xs text-destructive"
                    >
                      <AlertCircle
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{featuredDeployment.errorMessage}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No deployments yet. Click{" "}
                  <span className="font-medium text-foreground">
                    Deploy now
                  </span>{" "}
                  above to build and publish this project.
                </p>
              )}
            </div>

            {featuredDeployment ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {featuredLiveUrl ? (
                  <Button asChild size="sm">
                    <a
                      href={featuredLiveUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>Visit site</span>
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/projects/${id}/deployments/${featuredDeployment.id}`}
                  >
                    <span>Inspect logs</span>
                    <LinkPendingIndicator
                      fallback={
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      }
                    />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_290px]">
          <DeploymentsPanel
            projectId={id}
            deployments={deployments}
            liveDeploymentId={latestReadyDeployment?.id ?? null}
            hasMore={deploymentsResult.pageInfo.hasMore}
          />
          <ProjectSettingsCard key={project.updatedAt} project={project} />
        </div>

        <ProjectEnvVarsCard
          key={envVarsResult.envVars
            .map((variable) => `${variable.id}:${variable.updatedAt}`)
            .join(",")}
          projectId={id}
          envVars={envVarsResult.envVars}
        />
      </div>
    </PageShell>
  )
}
