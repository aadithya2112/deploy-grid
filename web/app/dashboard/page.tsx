import Link from "next/link"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Activity, ArrowRight, Server } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createProject,
  createProjectDeployment,
  getApiBaseUrlForUi,
  getHealth,
  listProjects,
} from "@/lib/api"

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function optionalText(input: FormDataEntryValue | null) {
  if (typeof input !== "string") {
    return undefined
  }

  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

async function createProjectAction(formData: FormData) {
  "use server"

  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const repoUrl = optionalText(formData.get("repoUrl"))

  if (!repoUrl) {
    return
  }

  const project = await createProject(userId, {
    repoUrl,
    name: optionalText(formData.get("name")),
    defaultBranch: optionalText(formData.get("defaultBranch")),
    rootDirectory: optionalText(formData.get("rootDirectory")) ?? null,
    installCommand: optionalText(formData.get("installCommand")) ?? null,
    buildCommand: optionalText(formData.get("buildCommand")) ?? null,
    outputDirectory: optionalText(formData.get("outputDirectory")) ?? null,
  })
  const deployment = await createProjectDeployment(userId, project.id)

  revalidatePath("/dashboard")
  redirect(`/projects/${project.id}/deployments/${deployment.id}`)
}

export default async function DashboardPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  let healthError: string | null = null
  let projectError: string | null = null

  const [health, projects] = await Promise.all([
    getHealth().catch((error) => {
      healthError =
        error instanceof Error ? error.message : "Failed to load health"
      return null
    }),
    listProjects(userId, { limit: 20 }).catch((error) => {
      projectError =
        error instanceof Error ? error.message : "Failed to load projects"
      return {
        projects: [],
        pageInfo: { limit: 20, offset: 0, hasMore: false, nextOffset: null },
      }
    }),
  ])

  return (
    <PageShell
      title="Deploy Grid"
      description="Projects, deployments, and logs in one place."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard">Refresh</Link>
          </Button>
          <UserButton />
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
          <CardDescription>
            Add a GitHub repository and optional build settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createProjectAction}
            className="grid gap-3 md:grid-cols-2"
          >
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="repoUrl">GitHub URL</Label>
              <Input
                id="repoUrl"
                name="repoUrl"
                type="url"
                placeholder="https://github.com/owner/repo.git"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Project name</Label>
              <Input id="name" name="name" placeholder="my-app" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="defaultBranch">Default branch</Label>
              <Input
                id="defaultBranch"
                name="defaultBranch"
                placeholder="main"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rootDirectory">Root directory</Label>
              <Input
                id="rootDirectory"
                name="rootDirectory"
                placeholder="apps/web"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="outputDirectory">Output directory</Label>
              <Input
                id="outputDirectory"
                name="outputDirectory"
                placeholder="dist"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="installCommand">Install command</Label>
              <Input
                id="installCommand"
                name="installCommand"
                placeholder="bun install"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="buildCommand">Build command</Label>
              <Input
                id="buildCommand"
                name="buildCommand"
                placeholder="bun run build"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create project</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" /> API health
            </CardTitle>
            <CardDescription>Live status from /health.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {health ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={health.status === "ok" ? "default" : "destructive"}
                  >
                    {health.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Database: {health.database}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getApiBaseUrlForUi()}
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">
                {healthError ?? "Unable to load health"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-4" /> Status legend
            </CardTitle>
            <CardDescription>
              Deployment states from API + worker lifecycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <DeploymentStatusBadge status="queued" />
            <DeploymentStatusBadge status="building" />
            <DeploymentStatusBadge status="ready" />
            <DeploymentStatusBadge status="failed" />
            <DeploymentStatusBadge status="cancelled" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            Showing up to {projects.pageInfo.limit} projects. Select one to
            inspect deployments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectError ? (
            <p className="text-sm text-destructive">{projectError}</p>
          ) : projects.projects.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Server className="size-4" />
                </EmptyMedia>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>
                  Create a project via API and it will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Default branch</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {project.repoUrl}
                      </div>
                    </TableCell>
                    <TableCell>{project.defaultBranch}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(project.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
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
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
