import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  FolderGit2,
  GitBranch,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react"

import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
      description="Your repositories, deployments, and build history."
      actions={
        <>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard">
              <RefreshCcw className="size-3.5" /> Refresh
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-3.5" /> New Project
            </Link>
          </Button>
        </>
      }
    >
      <section aria-labelledby="projects-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="projects-heading" className="text-sm font-medium">
            Your projects
          </h2>
          <span className="text-xs text-muted-foreground">
            {sortedProjects.length}{" "}
            {sortedProjects.length === 1 ? "project" : "projects"}
            {query ? " found" : ""}
          </span>
        </div>
        <form
          action="/dashboard"
          className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
        >
          <label htmlFor="project-search" className="sr-only">
            Find a project
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="project-search"
              type="search"
              name="query"
              defaultValue={query}
              placeholder="Find a project or repository…"
              className="h-10 border-0 bg-transparent pl-7 shadow-none focus-visible:ring-2 dark:bg-transparent"
            />
          </div>
          <Button type="submit" variant="ghost" size="sm">
            Search
          </Button>
          {query ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Clear</Link>
            </Button>
          ) : null}
        </form>

        {projectError ? (
          <div role="alert" className="border-b border-border py-8">
            <p className="text-sm text-destructive">{projectError}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Refresh to try loading your projects again.
            </p>
          </div>
        ) : sortedProjects.length ? (
          <ul className="divide-y divide-border">
            {sortedProjects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 rounded-sm py-6 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none sm:px-2"
                  aria-label={`Open ${project.name}`}
                >
                  <span
                    className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40 font-heading text-sm font-medium text-primary dark:text-chart-2"
                    aria-hidden="true"
                  >
                    {project.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-sm font-medium group-hover:text-primary dark:group-hover:text-chart-2">
                        {project.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        <GitBranch className="size-3" aria-hidden="true" />
                        {project.defaultBranch}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {project.repoUrl
                        .replace(/^https?:\/\/github\.com\//, "")
                        .replace(/\.git$/, "")}
                    </p>
                  </div>
                  <div className="flex items-center gap-5">
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
          <div className="flex flex-col items-center border-b border-border px-4 py-20 text-center">
            <FolderGit2
              className="mb-5 size-8 text-primary/70"
              aria-hidden="true"
            />
            <h3 className="font-heading text-xl font-medium">
              {query ? "No matching projects" : "No projects yet"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {query
                ? "Try another project name or repository URL."
                : "Connect a repository to start your first deployment."}
            </p>
            <Button
              asChild
              className="mt-6"
              variant={query ? "outline" : "default"}
            >
              <Link href={query ? "/dashboard" : "/projects/new"}>
                {query ? "Clear search" : "New Project"}
              </Link>
            </Button>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
          <p>
            {projects.pageInfo.hasMore
              ? `Showing the latest ${projects.pageInfo.limit} projects.`
              : "Sorted by most recently updated."}
          </p>
          <p>Open a project to view deployments and logs.</p>
        </div>
      </section>
    </PageShell>
  )
}
