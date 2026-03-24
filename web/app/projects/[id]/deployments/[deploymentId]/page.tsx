import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, RefreshCcw } from "lucide-react"

import { DeploymentLiveView } from "@/components/deployments/live-deployment-view"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { getAuth } from "@/lib/auth"
import { ApiRequestError, getDeployment, listDeploymentLogs } from "@/lib/api"

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string; deploymentId: string }>
}) {
  const { id, deploymentId } = await params
  const { userId } = await getAuth()

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
      <DeploymentLiveView
        projectId={id}
        deploymentId={deploymentId}
        initialDeployment={deployment}
        initialLogs={logs.logs}
      />
    </PageShell>
  )
}
