import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Activity,
  ArrowRight,
  FolderGit2,
  Plus,
  Search,
  Server,
  ShieldCheck,
} from "lucide-react"
import { UserButton } from "@clerk/nextjs"

import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { PageShell } from "@/components/layout/page-shell"
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
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAuth } from "@/lib/auth"
import { getApiBaseUrlForUi, getHealth, listProjects } from "@/lib/api"
import { isE2ETestMode } from "@/lib/test-mode"

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function normalizeQuery(input: string | string[] | undefined) {
  if (typeof input !== "string") {
    return ""
  }

  return input.trim()
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string | string[] }>
}) {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  const params = searchParams ? await searchParams : undefined
  const query = normalizeQuery(params?.query)

  let healthError: string | null = null
  let projectError: string | null = null

  const [health, projects] = await Promise.all([
    getHealth().catch((error) => {
      healthError =
        error instanceof Error ? error.message : "Failed to load health"
      return null
    }),
    listProjects(userId, {
      limit: 20,
      query: query || undefined,
    }).catch((error) => {
      projectError =
        error instanceof Error ? error.message : "Failed to load projects"
      return {
        projects: [],
        pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
      }
    }),
  ])

  const sortedProjects = [...projects.projects].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )
  const hasProjects = sortedProjects.length > 0
  const hasQuery = query.length > 0

  return (
    <PageShell
      title="Projects"
      description="Manage repositories, open active deployments, and jump back into build history."
      actions={
        <>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-3.5" />
              New Project
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Refresh</Link>
          </Button>
          {isE2ETestMode() ? null : <UserButton />}
        </>
      }
    >
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="border-b border-border/70 px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Workspace
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Your projects
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showing up to {projects.pageInfo.limit} repositories for this signed-in user.
                </p>
              </div>
              <form action="/dashboard" className="flex w-full max-w-md items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="query"
                    defaultValue={query}
                    placeholder="Search by project name or repo URL"
                    className="h-10 rounded-full pl-10"
                  />
                </div>
                <Button type="submit" variant="outline" className="rounded-full">
                  Search
                </Button>
                {hasQuery ? (
                  <Button asChild variant="ghost" className="rounded-full">
                    <Link href="/dashboard">Clear</Link>
                  </Button>
                ) : null}
              </form>
            </div>
          </div>

          <div className="px-5 py-5 md:px-6">
            {projectError ? (
              <p className="text-sm text-destructive">{projectError}</p>
            ) : hasProjects ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.map((project) => (
                    <TableRow
                      key={project.id}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {project.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {project.repoUrl}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-full font-mono text-[11px]"
                        >
                          {project.defaultBranch}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(project.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                        >
                          <Link href={`/projects/${project.id}`}>
                            Open
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className="rounded-[24px] border border-dashed border-border/80 bg-muted/[0.25] px-6 py-10 text-left">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {hasQuery ? (
                      <Search className="size-4" />
                    ) : (
                      <FolderGit2 className="size-4" />
                    )}
                  </EmptyMedia>
                  <EmptyTitle>
                    {hasQuery ? "No matching projects" : "No projects yet"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasQuery
                      ? "Try another search term or clear the filter to see all projects."
                      : "Start by connecting a repository. Creating a project also starts the first deployment and sends you straight to the logs."}
                  </EmptyDescription>
                </EmptyHeader>
                <div className="mt-5 flex flex-wrap gap-2">
                  {hasQuery ? (
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href="/dashboard">Clear search</Link>
                    </Button>
                  ) : null}
                  <Button asChild className="rounded-full">
                    <Link href="/projects/new">
                      <Plus className="size-4" />
                      New Project
                    </Link>
                  </Button>
                </div>
              </Empty>
            )}
          </div>
        </div>

        <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,252,0.92))] px-5 py-5 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.9),rgba(15,23,42,0.86))]">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Summary
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Visible projects
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {sortedProjects.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Primary flow
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Project → deployment → logs
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-muted/[0.35] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  API health
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Live status from /health.
                </h3>
              </div>
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-6 space-y-3">
              {health ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={health.status === "ok" ? "default" : "destructive"}
                      className="rounded-full px-3"
                    >
                      {health.status}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3">
                      Database: {health.database}
                    </Badge>
                  </div>
                  <p className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2 font-mono text-xs text-muted-foreground">
                    {getApiBaseUrlForUi()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-destructive">
                  {healthError ?? "Unable to load health"}
                </p>
              )}
            </div>
          </div>

          <Card className="rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Deployment states
              </CardTitle>
              <CardDescription>
                The same status badges appear across project and deployment views.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <DeploymentStatusBadge status="queued" />
              <DeploymentStatusBadge status="building" />
              <DeploymentStatusBadge status="ready" />
              <DeploymentStatusBadge status="failed" />
              <DeploymentStatusBadge status="cancelled" />
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="size-4" />
                Workspace model
              </CardTitle>
              <CardDescription>
                This dashboard prioritizes existing projects before creation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Use `New Project` when you want to connect another repository.</p>
              <p>Opening a project takes you to deployments first, with env vars and settings underneath.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </PageShell>
  )
}
