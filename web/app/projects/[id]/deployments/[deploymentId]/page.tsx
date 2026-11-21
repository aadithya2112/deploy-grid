import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ExternalLink, RotateCcw } from "lucide-react"

import { redeployDeploymentAction } from "@/app/projects/actions"
import { DeploymentLiveView } from "@/components/deployments/live-deployment-view"
import { PageShell } from "@/components/layout/page-shell"
import { RefreshButton } from "@/components/layout/refresh-button"
import { Button } from "@/components/ui/button"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
import { SubmitButton } from "@/components/ui/submit-button"
import { ApiRequestError, getDeployment, listDeploymentLogs } from "@/lib/api"
import { getAuth } from "@/lib/auth"
import { getDeploymentLiveUrl } from "@/lib/deployment-format"

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
  const liveUrl =
    deployment.status === "ready" ? getDeploymentLiveUrl(deployment) : null

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
          <RefreshButton variant="outline" />
          <form action={redeployDeploymentAction}>
            <input type="hidden" name="projectId" value={id} />
            <input type="hidden" name="deploymentId" value={deployment.id} />
            <SubmitButton
              size="sm"
              variant={liveUrl ? "outline" : "default"}
              pendingText="Redeploying…"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Redeploy</span>
            </SubmitButton>
          </form>
          {liveUrl ? (
            <Button asChild size="sm">
              <a href={liveUrl} target="_blank" rel="noreferrer">
                <span>Visit site</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
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
