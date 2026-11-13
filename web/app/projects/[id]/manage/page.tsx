import Link from "next/link"
import { redirect } from "next/navigation"
import { getAuth } from "@/lib/auth"
import {
  getProject,
  getPlatformOverview,
  listProjectDeployments,
  listProjectEnvVars,
} from "@/lib/api"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
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
export default async function ManageProject({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string }>
}) {
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
      title={`${project.name} · Releases`}
      description="Publish static sites, manage previews, and restore a previous release."
      actions={
        <Button asChild variant="outline">
          <Link href={`/projects/${id}`}>Back to project</Link>
        </Button>
      }
    >
      {notice ? (
        <p role="status" className="rounded-xl border p-4 text-sm">
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
            <p className="text-sm">
              {platform.release?.deploymentId
                ? `Live deployment: ${platform.release.deploymentId.slice(0, 8)}`
                : "No production release yet"}
            </p>
            {platform.productionUrl && platform.release?.deploymentId ? (
              <a
                className="text-sm underline"
                href={platform.productionUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open production site
              </a>
            ) : null}
            <form action={manageProjectAction} className="space-y-3">
              <Fields projectId={id} operation="deploy" />
              <label className="block text-sm">
                Branch or commit
                <Input name="gitRef" defaultValue={project.defaultBranch} />
              </label>
              <label htmlFor="deployment-environment" className="block text-sm">
                Environment
                <select
                  id="deployment-environment"
                  name="environment"
                  className="mt-1 block w-full rounded-md border bg-background p-2"
                >
                  <option value="preview">Preview</option>
                  <option value="production">
                    Production — publish on success
                  </option>
                </select>
              </label>
              <Button type="submit">Build deployment</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>GitHub integration</CardTitle>
            <CardDescription>
              Default-branch pushes publish production. Pull requests from this
              repository create previews; fork PRs are skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {platform.release?.repository
                ? `Connected: ${platform.release.repository}`
                : "Install the Deploy Grid GitHub App on your repository, then connect your account."}
            </p>
            <Button asChild variant="outline">
              <a href={`/api/github/connect?projectId=${id}`}>Connect GitHub</a>
            </Button>
            <p className="text-xs text-muted-foreground">
              React/Vite, Vue/Vite, Astro static, and Next.js static export are
              supported. Server rendering is not available.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Deployments and rollback</CardTitle>
          <CardDescription>
            Restore an earlier release using “Promote”. Expired artifacts cannot
            be promoted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Deployment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Framework / target</th>
                  <th className="p-3">Build time</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deployments.deployments.map((deployment) => {
                  const detail = details.get(deployment.id)
                  return (
                    <tr key={deployment.id} className="border-b">
                      <td className="p-3">
                        <Link
                          className="underline"
                          href={`/projects/${id}/deployments/${deployment.id}`}
                        >
                          {deployment.id.slice(0, 8)}
                        </Link>
                        {platform.release?.deploymentId === deployment.id ? (
                          <span className="ml-2 text-xs">Live</span>
                        ) : null}
                      </td>
                      <td className="p-3">
                        {detail?.deletedAt ? "Expired" : deployment.status}
                      </td>
                      <td className="p-3">
                        {detail?.framework ?? "Detecting"} /{" "}
                        {detail?.environment ?? "preview"}
                        {detail?.pullRequest
                          ? ` · PR #${detail.pullRequest}`
                          : ""}
                      </td>
                      <td className="p-3">
                        {detail?.metrics.totalMs
                          ? `${(detail.metrics.totalMs / 1000).toFixed(1)}s`
                          : "—"}
                      </td>
                      <td className="p-3">
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
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                platform.release?.deploymentId === deployment.id
                              }
                            >
                              Promote
                            </Button>
                          </form>
                        ) : null}
                        {["queued", "building"].includes(deployment.status) ? (
                          <form action={manageProjectAction}>
                            <Fields projectId={id} operation="cancel" />
                            <input
                              type="hidden"
                              name="deploymentId"
                              value={deployment.id}
                            />
                            <Button size="sm" variant="outline">
                              Cancel
                            </Button>
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
              Leave commands and output blank to use framework defaults. Changes
              apply to new deployments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={manageProjectAction} className="space-y-3">
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
                <label key={key} className="block text-sm">
                  {label}
                  <Input name={key} defaultValue={project[key] ?? ""} />
                </label>
              ))}
              <Button type="submit">Save build settings</Button>
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
            {variables.envVars.map((variable) => (
              <form
                key={variable.id}
                action={manageProjectAction}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <Fields projectId={id} operation="delete-env" />
                <input type="hidden" name="key" value={variable.key} />
                <input type="hidden" name="target" value={variable.target} />
                <span>
                  {variable.key} · {variable.target} · {variable.maskedValue}
                </span>
                <Button size="sm" variant="ghost">
                  Delete
                </Button>
              </form>
            ))}
            <form action={manageProjectAction} className="space-y-3">
              <Fields projectId={id} operation="env" />
              <label className="block text-sm">
                Key
                <Input name="key" required pattern="[A-Za-z_][A-Za-z0-9_]*" />
              </label>
              <label className="block text-sm">
                Value
                <Input
                  name="value"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="block text-sm">
                Target
                <select
                  name="target"
                  className="mt-1 block w-full rounded-md border bg-background p-2"
                >
                  <option value="all">All builds</option>
                  <option value="preview">Preview</option>
                  <option value="production">Production</option>
                </select>
              </label>
              <Button type="submit">Save variable</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Release history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {platform.history.map((event, index) => (
              <li key={`${event.createdAt}-${index}`}>
                {new Date(event.createdAt).toLocaleString()} ·{" "}
                {event.deploymentId.slice(0, 8)} · {event.actor}
              </li>
            ))}
          </ul>
          {platform.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your release history will appear here.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </PageShell>
  )
}
