import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
import { SubmitButton } from "@/components/ui/submit-button"
import {
  getPlatformOverview,
  getProject,
  listProjectDeployments,
  listProjectEnvVars,
} from "@/lib/api"
import { getAuth } from "@/lib/auth"
import { isStaticPlatformEnabled } from "@/lib/static-platform"
import { manageProjectAction } from "./actions"

function Fields({
  projectId,
  operation,
}: {
  projectId: string
  operation: string
}) {
  return (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="operation" value={operation} />
    </>
  )
}

const selectClass =
  "mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"

export default async function ManageProject({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  if (!isStaticPlatformEnabled()) notFound()
  const [{ id }, { notice }, { userId }] = await Promise.all([
    params,
    searchParams,
    getAuth(),
  ])
  if (!userId) redirect("/sign-in")
  const [project, platform, deployments, variables] = await Promise.all([
    getProject(userId, id),
    getPlatformOverview(userId, id),
    listProjectDeployments(userId, id, { limit: 20 }),
    listProjectEnvVars(userId, id),
  ])
  const details = new Map(platform.builds.map((build) => [build.id, build]))

  return (
    <PageShell
      section="releases"
      project={{ id, name: project.name }}
      title={`${project.name} · Releases`}
      description="Publish static sites, manage previews, and restore a previous release."
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href={`/projects/${id}`}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to project</span>
            <LinkPendingIndicator />
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {notice ? (
          <p
            role="status"
            className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-foreground"
          >
            {notice}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Production</CardTitle>
              <CardDescription>
                Promoting a retained build switches the live site without
                rebuilding. Build-time environment values stay with that build.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/35 px-3.5 py-2.5 text-sm">
                <p className="font-mono text-xs text-foreground">
                  {platform.release?.deploymentId
                    ? `Live deployment: ${platform.release.deploymentId.slice(0, 8)}`
                    : "No production release yet"}
                </p>
                {platform.productionUrl && platform.release?.deploymentId ? (
                  <a
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-chart-2"
                    href={platform.productionUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open production site
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : null}
              </div>

              <form action={manageProjectAction} className="space-y-3.5">
                <Fields projectId={id} operation="deploy" />
                <label className="block text-xs font-medium text-foreground">
                  Branch or commit
                  <Input
                    name="gitRef"
                    defaultValue={project.defaultBranch}
                    className="mt-1.5"
                  />
                </label>
                <label
                  htmlFor="deployment-environment"
                  className="block text-xs font-medium text-foreground"
                >
                  Environment
                  <select
                    id="deployment-environment"
                    name="environment"
                    className={selectClass}
                  >
                    <option value="preview">Preview</option>
                    <option value="production">
                      Production — publish on success
                    </option>
                  </select>
                </label>
                <SubmitButton size="sm" pendingText="Starting build…">
                  Build deployment
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GitHub integration</CardTitle>
              <CardDescription>
                Default-branch pushes publish production. Pull requests from
                this repository create previews; fork PRs are skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-lg border border-border bg-muted/35 px-3.5 py-2.5 text-xs text-foreground">
                {platform.release?.repository
                  ? `Connected: ${platform.release.repository}`
                  : "Install the Deploy Grid GitHub App on your repository, then connect your account."}
              </p>
              <Button asChild size="sm" variant="outline">
                <a href={`/api/github/connect?projectId=${id}`}>
                  Connect GitHub
                </a>
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                React/Vite, Vue/Vite, Astro static, and Next.js static export
                are supported. Server rendering is not available.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deployments and rollback</CardTitle>
            <CardDescription>
              Restore an earlier release using “Promote”. Expired artifacts
              cannot be promoted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Deployment</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">
                      Framework / target
                    </th>
                    <th className="px-3 py-2.5 font-medium">Build time</th>
                    <th className="px-3 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {deployments.deployments.map((deployment) => {
                    const detail = details.get(deployment.id)
                    return (
                      <tr key={deployment.id} className="hover:bg-muted/30">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-foreground underline-offset-4 hover:text-primary hover:underline dark:hover:text-chart-2"
                              href={`/projects/${id}/deployments/${deployment.id}`}
                            >
                              <span>{deployment.id.slice(0, 8)}</span>
                              <LinkPendingIndicator />
                            </Link>
                            {platform.release?.deploymentId ===
                            deployment.id ? (
                              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary dark:text-chart-2">
                                Live
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {detail?.deletedAt ? (
                            <span className="text-xs text-muted-foreground">
                              Expired
                            </span>
                          ) : (
                            <DeploymentStatusBadge status={deployment.status} />
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {detail?.framework ?? "Detecting"} /{" "}
                          {detail?.environment ?? "preview"}
                          {detail?.pullRequest
                            ? ` · PR #${detail.pullRequest}`
                            : ""}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {detail?.metrics.totalMs
                            ? `${(detail.metrics.totalMs / 1000).toFixed(1)}s`
                            : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {deployment.status === "ready" &&
                          !detail?.deletedAt &&
                          detail ? (
                            <form action={manageProjectAction}>
                              <Fields projectId={id} operation="promote" />
                              <input
                                type="hidden"
                                name="deploymentId"
                                value={deployment.id}
                              />
                              <SubmitButton
                                size="sm"
                                variant="outline"
                                pendingText="Promoting…"
                                disabled={
                                  platform.release?.deploymentId ===
                                  deployment.id
                                }
                              >
                                Promote
                              </SubmitButton>
                            </form>
                          ) : null}
                          {["queued", "building"].includes(
                            deployment.status
                          ) ? (
                            <form action={manageProjectAction}>
                              <Fields projectId={id} operation="cancel" />
                              <input
                                type="hidden"
                                name="deploymentId"
                                value={deployment.id}
                              />
                              <SubmitButton
                                size="sm"
                                variant="outline"
                                pendingText="Cancelling…"
                              >
                                Cancel
                              </SubmitButton>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Build settings</CardTitle>
              <CardDescription>
                Leave commands and output blank to use framework defaults.
                Changes apply to new deployments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={manageProjectAction} className="space-y-3.5">
                <Fields projectId={id} operation="settings" />
                {(
                  [
                    ["defaultBranch", "Default branch"],
                    ["rootDirectory", "Project root"],
                    ["installCommand", "Install command"],
                    ["buildCommand", "Build command"],
                    ["outputDirectory", "Output directory"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="block text-xs font-medium text-foreground"
                  >
                    {label}
                    <Input
                      name={key}
                      defaultValue={project[key] ?? ""}
                      className="mt-1.5"
                    />
                  </label>
                ))}
                <SubmitButton size="sm" pendingText="Saving settings…">
                  Save build settings
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environment variables</CardTitle>
              <CardDescription>
                Values are encrypted at rest. Values used in browser code become
                public in the generated site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {variables.envVars.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {variables.envVars.map((variable) => (
                    <form
                      key={variable.id}
                      action={manageProjectAction}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                    >
                      <Fields projectId={id} operation="delete-env" />
                      <input type="hidden" name="key" value={variable.key} />
                      <input
                        type="hidden"
                        name="target"
                        value={variable.target}
                      />
                      <span className="truncate font-mono">
                        {variable.key} · {variable.target} ·{" "}
                        {variable.maskedValue}
                      </span>
                      <SubmitButton
                        size="sm"
                        variant="ghost"
                        pendingText="Deleting…"
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              ) : null}

              <form action={manageProjectAction} className="space-y-3.5">
                <Fields projectId={id} operation="env" />
                <label className="block text-xs font-medium text-foreground">
                  Key
                  <Input
                    name="key"
                    required
                    pattern="[A-Za-z_][A-Za-z0-9_]*"
                    className="mt-1.5"
                  />
                </label>
                <label className="block text-xs font-medium text-foreground">
                  Value
                  <Input
                    name="value"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="mt-1.5"
                  />
                </label>
                <label className="block text-xs font-medium text-foreground">
                  Target
                  <select name="target" className={selectClass}>
                    <option value="all">All builds</option>
                    <option value="preview">Preview</option>
                    <option value="production">Production</option>
                  </select>
                </label>
                <SubmitButton size="sm" pendingText="Saving variable…">
                  Save variable
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Release history</CardTitle>
          </CardHeader>
          <CardContent>
            {platform.history.length > 0 ? (
              <ul className="divide-y divide-border text-xs">
                {platform.history.map((event, index) => (
                  <li
                    key={`${event.createdAt}-${index}`}
                    className="flex flex-wrap items-center gap-2 py-2.5 font-mono text-muted-foreground first:pt-0 last:pb-0"
                  >
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
                    <span>·</span>
                    <span className="text-foreground">
                      {event.deploymentId.slice(0, 8)}
                    </span>
                    <span>·</span>
                    <span>{event.actor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your release history will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
