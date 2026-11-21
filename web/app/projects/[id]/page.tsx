import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowRight,
  ExternalLink,
  GitBranch,
  KeyRound,
  Layers,
  Play,
  Settings2,
} from "lucide-react"

import { deployProjectAction } from "@/app/projects/actions"
import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
import { SubmitButton } from "@/components/ui/submit-button"
import { getAuth } from "@/lib/auth"
import {
  ApiRequestError,
  getProject,
  listProjectDeployments,
  listProjectEnvVars,
} from "@/lib/api"
import { isStaticPlatformEnabled } from "@/lib/static-platform"

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
  const latestDeployment = deploymentsResult.deployments[0] ?? null
  const settings = [
    ["Default branch", project.defaultBranch],
    ["Root directory", project.rootDirectory ?? "Repository root"],
    ["Install command", project.installCommand ?? "Automatic"],
    ["Build command", project.buildCommand ?? "Automatic"],
    ["Output directory", project.outputDirectory ?? "dist"],
  ]

  return (
    <PageShell
      title={project.name}
      description="Deployments, environment variables, and build configuration."
      section="project"
      project={{ id, name: project.name }}
      actions={
        <>
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
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
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

        <section
          aria-labelledby="latest-heading"
          className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.25)] sm:p-6"
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 bg-primary dark:bg-chart-2"
          />
          <div className="flex flex-wrap items-center justify-between gap-4 pl-2">
            <div className="min-w-0">
              <h2
                id="latest-heading"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Latest deployment
              </h2>
              {latestDeployment ? (
                <>
                  <Link
                    href={`/projects/${id}/deployments/${latestDeployment.id}`}
                    className="group mt-2 inline-flex items-center gap-2 font-heading text-lg font-semibold transition-colors hover:text-primary dark:hover:text-chart-2"
                  >
                    <span className="font-mono">
                      {latestDeployment.commitSha
                        ? latestDeployment.commitSha.slice(0, 8)
                        : latestDeployment.id.slice(0, 8)}
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
                  <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                    {latestDeployment.gitRef} ·{" "}
                    {formatDate(latestDeployment.createdAt)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No deployments yet. Start a build to publish this project.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {latestDeployment ? (
                <DeploymentStatusBadge status={latestDeployment.status} />
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section
            id="deployments"
            aria-labelledby="deployments-heading"
            className="min-w-0 scroll-mt-20 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="deployments-heading"
                className="font-heading text-sm font-semibold tracking-tight"
              >
                Recent deployments
              </h2>
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {deploymentsResult.deployments.length}{" "}
                {deploymentsResult.deployments.length === 1
                  ? "build"
                  : "builds"}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {deploymentsResult.deployments.length ? (
                <ul className="divide-y divide-border">
                  {deploymentsResult.deployments.map((deployment) => (
                    <li key={deployment.id}>
                      <Link
                        href={`/projects/${id}/deployments/${deployment.id}`}
                        className="group flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                        aria-label={`Open deployment ${deployment.id.slice(0, 8)}`}
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <DeploymentStatusBadge status={deployment.status} />
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-medium break-all text-foreground">
                              {deployment.commitSha?.slice(0, 8) ??
                                deployment.id.slice(0, 8)}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {deployment.gitRef}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <time
                            dateTime={deployment.createdAt}
                            className="text-xs text-muted-foreground"
                          >
                            {new Date(deployment.createdAt).toLocaleDateString(
                              "en",
                              { month: "short", day: "numeric" }
                            )}
                          </time>
                          <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary dark:group-hover:text-chart-2">
                            <LinkPendingIndicator
                              fallback={
                                <ArrowRight
                                  className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                                  aria-hidden="true"
                                />
                              }
                            />
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-10 text-sm text-muted-foreground">
                  Your build history will appear here after the first
                  deployment.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Select a deployment to inspect its output and logs.
            </p>
          </section>

          <aside
            id="configuration"
            className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card p-5"
            aria-label="Project configuration"
          >
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-3.5">
              <Settings2
                className="size-4 text-primary dark:text-chart-2"
                aria-hidden="true"
              />
              <h2 className="font-heading text-sm font-semibold tracking-tight">
                Build settings
              </h2>
            </div>
            <dl className="divide-y divide-border/70">
              {settings.map(([label, value]) => (
                <div key={label} className="py-3 first:pt-0 last:pb-0">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-mono text-xs leading-5 break-all text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <section
          id="environment"
          className="scroll-mt-20 space-y-3"
          aria-labelledby="environment-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound
                className="size-4 text-primary dark:text-chart-2"
                aria-hidden="true"
              />
              <h2
                id="environment-heading"
                className="font-heading text-sm font-semibold tracking-tight"
              >
                Environment variables
              </h2>
            </div>
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {envVarsResult.envVars.length} variables
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {envVarsResult.envVars.length ? (
              <dl className="divide-y divide-border">
                {envVarsResult.envVars.map((variable) => (
                  <div
                    key={variable.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <dt className="flex flex-wrap items-center gap-2 font-mono text-xs break-all">
                      <span className="font-medium text-foreground">
                        {variable.key}
                      </span>
                      <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
                        {variable.target}
                      </span>
                    </dt>
                    <dd className="font-mono text-xs break-all text-muted-foreground">
                      {variable.maskedValue}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No environment variables.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Values are masked to keep your project secrets private.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
