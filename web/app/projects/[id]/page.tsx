import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  ExternalLink,
  FolderGit2,
  Play,
  RefreshCcw,
  Settings2,
} from "lucide-react"

import { deployProjectAction } from "@/app/projects/actions"
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
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAuth } from "@/lib/auth"
import {
  ApiRequestError,
  getProject,
  listProjectDeployments,
  listProjectEnvVars,
} from "@/lib/api"

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

  if (!userId) {
    redirect("/sign-in")
  }

  let project

  try {
    project = await getProject(userId, id)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound()
    }

    throw error
  }

  const [deploymentsResult, envVarsResult] = await Promise.all([
    listProjectDeployments(userId, id, { limit: 20 }),
    listProjectEnvVars(userId, id),
  ])

  const latestDeployment = deploymentsResult.deployments[0] ?? null

  return (
    <PageShell
      title={project.name}
      description="Deployments are the primary workspace for this repository. Environment variables and build defaults stay close by."
      actions={
        <>
          <form action={deployProjectAction}>
            <input type="hidden" name="projectId" value={id} />
            {latestDeployment ? (
              <input type="hidden" name="gitRef" value={latestDeployment.gitRef} />
            ) : (
              <input type="hidden" name="gitRef" value={project.defaultBranch} />
            )}
            <Button size="sm">
              <Play className="size-3.5" />
              {latestDeployment ? "Redeploy latest" : "Deploy now"}
            </Button>
          </form>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${id}`}>
              <RefreshCcw className="size-3.5" />
              Refresh
            </Link>
          </Button>
        </>
      }
    >
      <section className="mb-6 grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.92))] dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.9),rgba(15,23,42,0.86))]">
          <div className="border-b border-border/70 px-5 py-5 md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3">
                <FolderGit2 className="size-3" />
                Project
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full px-3 font-mono text-[11px]"
              >
                {project.defaultBranch}
              </Badge>
            </div>
            <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
              {project.name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={project.repoUrl}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="max-w-[32rem] truncate font-mono text-xs">
                  {project.repoUrl}
                </span>
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
          <div className="grid gap-3 px-5 py-5 text-sm md:grid-cols-3 md:px-6">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Deployments
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {deploymentsResult.deployments.length}
              </p>
              <p className="mt-1 text-muted-foreground">
                Latest {deploymentsResult.pageInfo.limit} runs loaded.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Env vars
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {envVarsResult.envVars.length}
              </p>
              <p className="mt-1 text-muted-foreground">
                Masked values remain visible without exposing secrets.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Root directory
              </p>
              <p className="mt-2 truncate font-mono text-sm text-foreground">
                {project.rootDirectory ?? "(repo root)"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Current build defaults for new deployments.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Card className="rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Latest deployment</CardTitle>
              <CardDescription>
                The freshest run for this project is the quickest way back into logs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestDeployment ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <DeploymentStatusBadge status={latestDeployment.status} />
                    <Badge
                      variant="outline"
                      className="rounded-full font-mono text-[11px]"
                    >
                      {latestDeployment.gitRef}
                    </Badge>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4 text-sm">
                    <p className="text-muted-foreground">Created</p>
                    <p className="mt-2 font-medium text-foreground">
                      {formatDate(latestDeployment.createdAt)}
                    </p>
                    <p className="mt-3 text-muted-foreground">Commit</p>
                    <p className="mt-2 font-mono text-xs text-foreground">
                      {latestDeployment.commitSha ?? "—"}
                    </p>
                  </div>
                  <Button asChild className="w-full rounded-full" variant="outline">
                    <Link href={`/projects/${id}/deployments/${latestDeployment.id}`}>
                      Open latest deployment
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    No deployments have been created yet. Start the first one from this project page.
                  </p>
                  <form action={deployProjectAction}>
                    <input type="hidden" name="projectId" value={id} />
                    <input type="hidden" name="gitRef" value={project.defaultBranch} />
                    <Button className="w-full rounded-full">
                      <Play className="size-4" />
                      Deploy now
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Project defaults</CardTitle>
              <CardDescription>
                Build commands and paths used when the worker prepares a new run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                <p className="font-medium text-foreground">Default branch</p>
                <p className="mt-1 font-mono text-xs">{project.defaultBranch}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                <p className="font-medium text-foreground">Output directory</p>
                <p className="mt-1 font-mono text-xs">
                  {project.outputDirectory ?? "dist"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Tabs
        defaultValue="deployments"
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <TabsList className="mb-4 rounded-full border border-border/70 bg-muted/50 p-1">
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="env">Env vars</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments">
          <Card className="overflow-hidden rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Recent deployments</CardTitle>
              <CardDescription>
                Latest {deploymentsResult.pageInfo.limit} deployments for this project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deploymentsResult.deployments.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>No deployments yet</EmptyTitle>
                    <EmptyDescription>
                      Start the first deployment for this project and then return here to review build history.
                    </EmptyDescription>
                  </EmptyHeader>
                  <div className="mt-5">
                    <form action={deployProjectAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input
                        type="hidden"
                        name="gitRef"
                        value={project.defaultBranch}
                      />
                      <Button className="rounded-full">
                        <Play className="size-4" />
                        Deploy now
                      </Button>
                    </form>
                  </div>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Git ref</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deploymentsResult.deployments.map((deployment) => (
                      <TableRow
                        key={deployment.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <TableCell>
                          <DeploymentStatusBadge status={deployment.status} />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {deployment.gitRef}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(deployment.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                          >
                            <Link href={`/projects/${id}/deployments/${deployment.id}`}>
                              Open
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="env">
          <Card className="overflow-hidden rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle>Environment variables</CardTitle>
              <CardDescription>Masked values managed in the API.</CardDescription>
            </CardHeader>
            <CardContent>
              {envVarsResult.envVars.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>No environment variables</EmptyTitle>
                    <EmptyDescription>
                      Add project env vars in API and they will appear here.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Masked value</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {envVarsResult.envVars.map((envVar) => (
                      <TableRow
                        key={envVar.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <TableCell className="font-medium">{envVar.key}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="rounded-full px-3 capitalize"
                          >
                            {envVar.target}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {envVar.maskedValue}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(envVar.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="overflow-hidden rounded-[24px] border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-4" />
                Build settings
              </CardTitle>
              <CardDescription>
                Current project defaults used by worker jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Default branch</dt>
                  <dd className="mt-2 font-medium">{project.defaultBranch}</dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Root directory</dt>
                  <dd className="mt-2 font-medium">
                    {project.rootDirectory ?? "(repo root)"}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Install command</dt>
                  <dd className="mt-2 font-medium">
                    {project.installCommand ?? "(auto)"}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                  <dt className="text-muted-foreground">Build command</dt>
                  <dd className="mt-2 font-medium">
                    {project.buildCommand ?? "(auto)"}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4 md:col-span-2">
                  <dt className="text-muted-foreground">Output directory</dt>
                  <dd className="mt-2 font-medium">
                    {project.outputDirectory ?? "dist"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
