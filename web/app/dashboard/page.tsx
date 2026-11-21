import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  FolderGit2,
  GitBranch,
  Plus,
} from "lucide-react"

import { ProjectSearchForm } from "@/components/dashboard/project-search-form"
import { PageShell } from "@/components/layout/page-shell"
import { RefreshButton } from "@/components/layout/refresh-button"
import { Button } from "@/components/ui/button"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
import { getAuth } from "@/lib/auth"
import { listProjects } from "@/lib/api"

function normalizeQuery(input: string | string[] | undefined) {
  return typeof input === "string" ? input.trim() : ""
}

const emptyProjects = {
  projects: [],
  pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string | string[] }>
}) {
  const { userId } = await getAuth()
  if (!userId) redirect("/sign-in")

  const params = searchParams ? await searchParams : undefined
  const query = normalizeQuery(params?.query)
  const { projectError, projects } = await listProjects(userId, {
    limit: 20,
    query: query || undefined,
  })
    .then((projects) => ({ projectError: null, projects }))
    .catch((error) => ({
      projectError:
        error instanceof Error ? error.message : "Failed to load projects",
      projects: emptyProjects,
    }))
  const sortedProjects = [...projects.projects].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )

  return (
    <PageShell
      title="Projects"
      description="Manage connected repositories, trigger builds, and inspect deployment logs."
      actions={
        <>
          <RefreshButton variant="outline" />
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-3.5" aria-hidden="true" />
              <span>New Project</span>
              <LinkPendingIndicator className="text-primary-foreground dark:text-primary-foreground" />
            </Link>
          </Button>
        </>
      }
    >
      <section aria-labelledby="projects-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2
              id="projects-heading"
              className="font-heading text-sm font-semibold tracking-tight"
            >
              Your projects
            </h2>
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {sortedProjects.length}{" "}
              {sortedProjects.length === 1 ? "project" : "projects"}
              {query ? " found" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {projects.pageInfo.hasMore
              ? `Showing the latest ${projects.pageInfo.limit} projects`
              : "Sorted by most recently updated"}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_36px_-28px_rgba(15,23,42,0.25)]">
          <ProjectSearchForm initialQuery={query} />

          {projectError ? (
            <div
              role="alert"
              className="flex items-start gap-3 px-5 py-8 text-sm"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-destructive">{projectError}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Refresh above to try loading your projects again.
                </p>
              </div>
            </div>
          ) : sortedProjects.length ? (
            <ul className="divide-y divide-border">
              {sortedProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="group grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:px-5"
                    aria-label={`Open ${project.name}`}
                  >
                    <span
                      className="flex size-10 items-center justify-center rounded-lg border border-border bg-primary/8 font-heading text-sm font-semibold text-primary dark:bg-primary/15 dark:text-chart-2"
                      aria-hidden="true"
                    >
                      {project.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground transition-colors group-hover:text-primary dark:group-hover:text-chart-2">
                          {project.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          <GitBranch className="size-3" aria-hidden="true" />
                          {project.defaultBranch}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {project.repoUrl
                          .replace(/^https?:\/\/github\.com\//, "")
                          .replace(/\.git$/, "")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <time
                        dateTime={project.updatedAt}
                        className="hidden text-right text-xs text-muted-foreground sm:block"
                      >
                        Updated{" "}
                        {new Date(project.updatedAt).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
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
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-muted/40">
                <FolderGit2
                  className="size-6 text-primary dark:text-chart-2"
                  aria-hidden="true"
                />
              </div>
              <h3 className="font-heading text-lg font-semibold">
                {query ? "No matching projects" : "No projects yet"}
              </h3>
              <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
                {query
                  ? "Try another project name or repository URL."
                  : "Connect a GitHub repository to start your first deployment."}
              </p>
              <Button
                asChild
                size="sm"
                className="mt-5"
                variant={query ? "outline" : "default"}
              >
                <Link href={query ? "/dashboard" : "/projects/new"}>
                  <span>{query ? "Clear search" : "New Project"}</span>
                  <LinkPendingIndicator />
                </Link>
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Select a project to inspect deployments, build settings, and live
          logs.
        </p>
      </section>
    </PageShell>
  )
}
