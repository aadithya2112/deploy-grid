import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, RefreshCcw } from "lucide-react"
import { auth } from "@clerk/nextjs/server"

import { DeploymentStatusBadge } from "@/components/deployments/status-badge"
import { PageShell } from "@/components/layout/page-shell"
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
  const { userId } = await auth()

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

  return (
    <PageShell
      title={project.name}
      description={project.repoUrl}
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/projects/${id}`}>
              <RefreshCcw className="size-3.5" />
              Refresh
            </Link>
          </Button>
        </>
      }
    >
      <Tabs defaultValue="deployments">
        <TabsList>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="env">Env vars</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Recent deployments</CardTitle>
              <CardDescription>
                Latest {deploymentsResult.pageInfo.limit} deployments for this
                project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deploymentsResult.deployments.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>No deployments yet</EmptyTitle>
                    <EmptyDescription>
                      Trigger a deployment from API to see build progress here.
                    </EmptyDescription>
                  </EmptyHeader>
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
                      <TableRow key={deployment.id}>
                        <TableCell>
                          <DeploymentStatusBadge status={deployment.status} />
                        </TableCell>
                        <TableCell>{deployment.gitRef}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(deployment.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/projects/${id}/deployments/${deployment.id}`}
                            >
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
          <Card>
            <CardHeader>
              <CardTitle>Environment variables</CardTitle>
              <CardDescription>Masked values managed in API.</CardDescription>
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
                      <TableRow key={envVar.id}>
                        <TableCell className="font-medium">
                          {envVar.key}
                        </TableCell>
                        <TableCell>{envVar.target}</TableCell>
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
          <Card>
            <CardHeader>
              <CardTitle>Build settings</CardTitle>
              <CardDescription>
                Current project defaults used by worker jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground">Default branch</dt>
                  <dd className="font-medium">{project.defaultBranch}</dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground">Root directory</dt>
                  <dd className="font-medium">
                    {project.rootDirectory ?? "(repo root)"}
                  </dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground">Install command</dt>
                  <dd className="font-medium">
                    {project.installCommand ?? "(auto)"}
                  </dd>
                </div>
                <div className="rounded-lg border p-3">
                  <dt className="text-muted-foreground">Build command</dt>
                  <dd className="font-medium">
                    {project.buildCommand ?? "(auto)"}
                  </dd>
                </div>
                <div className="rounded-lg border p-3 md:col-span-2">
                  <dt className="text-muted-foreground">Output directory</dt>
                  <dd className="font-medium">
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
