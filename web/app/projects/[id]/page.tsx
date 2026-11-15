import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowRight, ExternalLink, GitBranch, Play } from "lucide-react"

import { deployProjectAction } from "@/app/projects/actions"
import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
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
              <Link href={`/projects/${id}/manage`}>Manage releases</Link>
            </Button>
          ) : null}
          <form action={deployProjectAction}>
            <input type="hidden" name="projectId" value={id} />
            <input
              type="hidden"
              name="gitRef"
              value={latestDeployment?.gitRef ?? project.defaultBranch}
            />
            <Button size="sm">
              <Play className="size-3.5" />
              {latestDeployment ? "Redeploy latest" : "Deploy now"}
            </Button>
          </form>
        </>
      }
    >
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border pb-5 text-xs text-muted-foreground">
        <Link
          href={project.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-2 text-foreground transition-colors hover:text-primary"
        >
          <span className="break-all">
            {project.repoUrl
              .replace(/^https?:\/\/github\.com\//, "")
              .replace(/\.git$/, "")}
          </span>
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        </Link>
        <span className="inline-flex items-center gap-1.5 font-mono">
          <GitBranch className="size-3" aria-hidden="true" />
          {project.defaultBranch}
        </span>
      </div>
      <section
        aria-labelledby="latest-heading"
        className="mb-10 border-l-2 border-primary pl-5 sm:pl-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2
              id="latest-heading"
              className="text-xs font-medium text-muted-foreground"
            >
              Latest deployment
            </h2>
            {latestDeployment ? (
              <>
                <Link
                  href={`/projects/${id}/deployments/${latestDeployment.id}`}
                  className="mt-3 inline-flex items-center gap-2 font-heading text-lg font-medium transition-colors hover:text-primary"
                >
                  {latestDeployment.commitSha
                    ? latestDeployment.commitSha.slice(0, 8)
                    : latestDeployment.id.slice(0, 8)}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {latestDeployment.gitRef} ·{" "}
                  {formatDate(latestDeployment.createdAt)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No deployments yet. Start a build to publish this project.
              </p>
            )}
          </div>
          {latestDeployment ? (
            <DeploymentStatusBadge status={latestDeployment.status} />
          ) : null}
        </div>
      </section>

      <div className="grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-12">
        <section
          id="deployments"
          aria-labelledby="deployments-heading"
          className="min-w-0 scroll-mt-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="deployments-heading" className="text-sm font-medium">
              Recent deployments
            </h2>
            <span className="text-xs text-muted-foreground">
              {deploymentsResult.deployments.length}{" "}
              {deploymentsResult.deployments.length === 1 ? "build" : "builds"}
            </span>
          </div>
          {deploymentsResult.deployments.length ? (
            <ul className="divide-y divide-border border-y border-border">
              {deploymentsResult.deployments.map((deployment) => (
                <li key={deployment.id}>
                  <Link
                    href={`/projects/${id}/deployments/${deployment.id}`}
                    className="group flex flex-wrap items-center justify-between gap-4 py-5 transition-colors hover:bg-muted/30 sm:px-1"
                    aria-label={`Open deployment ${deployment.id.slice(0, 8)}`}
                  >
                    <div className="min-w-0">
                      <DeploymentStatusBadge status={deployment.status} />
                      <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
                        {deployment.commitSha?.slice(0, 8) ??
                          deployment.id.slice(0, 8)}{" "}
                        <span className="px-1">·</span> {deployment.gitRef}
                      </p>
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
                      <ArrowRight
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-y border-border py-10 text-sm text-muted-foreground">
              Your build history will appear here after the first deployment.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Select a deployment to inspect its output and logs.
          </p>
        </section>

        <aside
          id="configuration"
          className="min-w-0 scroll-mt-6 xl:border-l xl:border-border xl:pl-7"
          aria-label="Project configuration"
        >
          <h2 className="mb-5 text-sm font-medium">Build settings</h2>
          <dl className="space-y-5">
            {settings.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1.5 font-mono text-xs leading-5 break-all">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
      <section
        id="environment"
        className="mt-12 border-t border-border pt-7"
        aria-labelledby="environment-heading"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="environment-heading" className="text-sm font-medium">
            Environment variables
          </h2>
          <span className="text-xs text-muted-foreground">
            {envVarsResult.envVars.length} variables
          </span>
        </div>
        {envVarsResult.envVars.length ? (
          <dl className="divide-y divide-border">
            {envVarsResult.envVars.map((variable) => (
              <div
                key={variable.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <dt className="font-mono text-xs break-all">
                  {variable.key}
                  <span className="ml-3 rounded border border-border px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
            No environment variables.
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Values are masked to keep your project secrets private.
        </p>
      </section>
    </PageShell>
  )
}
