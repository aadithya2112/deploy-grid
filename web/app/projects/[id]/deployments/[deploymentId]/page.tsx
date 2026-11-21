import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { DeploymentLiveView } from "@/components/deployments/live-deployment-view"
import { PageShell } from "@/components/layout/page-shell"
import { RefreshButton } from "@/components/layout/refresh-button"
import { Button } from "@/components/ui/button"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
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
      section="deployment"
      project={{
        id,
        name:
          deployment.repoUrl
            .replace(/\.git$/, "")
            .split("/")
            .at(-1) ?? "Project",
      }}
      title={`Deployment ${deployment.id.slice(0, 8)}`}
      description={`${deployment.repoUrl} • ${deployment.gitRef}`}
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${id}`}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Back</span>
              <LinkPendingIndicator />
            </Link>
          </Button>
          <RefreshButton variant="default" />
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
