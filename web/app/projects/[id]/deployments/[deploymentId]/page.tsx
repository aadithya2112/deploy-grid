import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, RefreshCcw } from "lucide-react"
import { auth } from "@clerk/nextjs/server"

import { DeploymentAutoRefresh } from "@/components/deployments/auto-refresh"
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
import { ApiRequestError, getDeployment, listDeploymentLogs } from "@/lib/api"

function formatDate(value: string | null) {
  if (!value) {
    return "—"
  }

  return new Date(value).toLocaleString()
}

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string; deploymentId: string }>
}) {
  const { id, deploymentId } = await params
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  let deployment

  try {
    deployment = await getDeployment(userId, deploymentId)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound()
    }

    throw error
  }

  if (deployment.projectId !== id) {
    notFound()
  }

  const logs = await listDeploymentLogs(userId, deploymentId, { limit: 200 })
  const shouldAutoRefresh =
    deployment.status === "queued" || deployment.status === "building"

  return (
    <PageShell
      title={`Deployment ${deployment.id.slice(0, 8)}`}
      description={`${deployment.repoUrl} • ${deployment.gitRef}`}
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${id}`}>
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/projects/${id}/deployments/${deploymentId}`}>
              <RefreshCcw className="size-3.5" />
              Refresh
            </Link>
          </Button>
        </>
      }
    >
      <DeploymentAutoRefresh enabled={shouldAutoRefresh} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              Deployment state and build metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <DeploymentStatusBadge status={deployment.status} />
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">Commit SHA</dt>
                <dd className="font-mono text-xs">
                  {deployment.commitSha ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">
                  {formatDate(deployment.createdAt)}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="font-medium">
                  {formatDate(deployment.updatedAt)}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">Build started</dt>
                <dd className="font-medium">
                  {formatDate(deployment.buildStartedAt)}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">Build finished</dt>
                <dd className="font-medium">
                  {formatDate(deployment.buildFinishedAt)}
                </dd>
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <dt className="text-muted-foreground">Preview URL</dt>
                <dd className="truncate font-medium">
                  {deployment.previewUrl ? (
                    <Link
                      href={deployment.previewUrl}
                      target="_blank"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {deployment.previewUrl}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <dt className="text-muted-foreground">Artifact URL</dt>
                <dd className="truncate font-medium">
                  {deployment.artifactUrl ? (
                    <Link
                      href={deployment.artifactUrl}
                      target="_blank"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {deployment.artifactUrl}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            {deployment.errorMessage ? (
              <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {deployment.errorMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project</CardTitle>
            <CardDescription>
              Navigate back to project-level view.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href={`/projects/${id}`}>Open project</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>
            Latest {logs.logs.length} log lines from /deployments/:id/logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shouldAutoRefresh ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Refreshing while this deployment is still running.
            </p>
          ) : null}
          {logs.logs.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No logs yet</EmptyTitle>
                <EmptyDescription>
                  Queue and worker activity logs will appear as the deployment
                  progresses.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="max-h-120 space-y-1 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
              {logs.logs.map((log) => (
                <p
                  key={log.id}
                  className="leading-relaxed wrap-break-word whitespace-pre-wrap"
                >
                  <span className="mr-2 text-muted-foreground">
                    #{log.sequence}
                  </span>
                  <span className="mr-2 text-muted-foreground">
                    [{log.stream}]
                  </span>
                  <span>{log.message}</span>
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
