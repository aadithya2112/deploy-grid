import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Rocket } from "lucide-react"

import { createProjectAndDeployAction } from "@/app/projects/actions"
import { PageShell } from "@/components/layout/page-shell"
import { ProjectCreateFields } from "@/components/projects/project-create-fields"
import { Button } from "@/components/ui/button"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
import { SubmitButton } from "@/components/ui/submit-button"
import { getAuth } from "@/lib/auth"

export default async function NewProjectPage() {
  const { userId } = await getAuth()
  if (!userId) redirect("/sign-in")

  return (
    <PageShell
      title="New Project"
      section="new"
      description="Connect a GitHub repository and launch your first static deployment."
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to projects</span>
            <LinkPendingIndicator />
          </Link>
        </Button>
      }
    >
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
        <form
          action={createProjectAndDeployAction}
          className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_36px_-28px_rgba(15,23,42,0.25)]"
        >
          <div className="border-b border-border px-6 py-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Repository
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Paste a GitHub URL. Framework detection and build defaults run
              automatically unless overridden.
            </p>
          </div>
          <div className="space-y-6 p-6">
            <ProjectCreateFields />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/25 px-6 py-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <SubmitButton
              size="sm"
              pendingText="Creating & deploying…"
              className="px-4"
            >
              <span>Create and deploy</span>
              <Rocket className="size-3.5" aria-hidden="true" />
            </SubmitButton>
          </div>
        </form>

        <aside className="rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            What happens next
          </h2>
          <ol className="mt-5 space-y-5">
            {[
              [
                "Connect the repository",
                "Create a project or reuse an existing repository in your workspace.",
              ],
              [
                "Run an isolated build",
                "Detect your framework, install dependencies, and compile static assets.",
              ],
              [
                "Stream live logs",
                "Follow progress in real time and open the published output once ready.",
              ],
            ].map(([title, description], index) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[11px] font-medium text-primary dark:text-chart-2">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-xs font-medium text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </PageShell>
  )
}
