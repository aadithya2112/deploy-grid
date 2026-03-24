import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react"

import { createProjectAndDeployAction } from "@/app/projects/actions"
import { ProjectCreateFields } from "@/components/projects/project-create-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { getAuth } from "@/lib/auth"

export default async function NewProjectPage() {
  const { userId } = await getAuth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <PageShell
      title="New Project"
      description="Connect a repository and land directly in the first deployment log."
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" />
            Back to projects
          </Link>
        </Button>
      }
    >
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,252,0.92))] dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.9),rgba(15,23,42,0.86))] animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="border-b border-border/70 px-5 py-5 md:px-6">
            <Badge
              variant="outline"
              className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              Create and deploy
            </Badge>
            <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-foreground">
              Start with the repo URL, then add build defaults only if the project needs them.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This route is intentionally focused: connect the repository, confirm any custom paths or commands, and move directly into the live build log.
            </p>
          </div>

          <form action={createProjectAndDeployAction} className="space-y-5 px-5 py-5 md:px-6">
            <ProjectCreateFields />

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                If the repo already exists for this user, we reuse it and start a fresh deployment.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/dashboard">Cancel</Link>
                </Button>
                <Button type="submit" className="rounded-full px-5">
                  Create and deploy
                  <Rocket className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="rounded-[24px] border border-border/70 bg-background p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              What happens next
            </p>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                <p className="font-medium text-foreground">1. Project record resolves</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  We create a new project or reuse the existing one for this signed-in user.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                <p className="font-medium text-foreground">2. First deployment starts</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The API kicks off the initial deployment immediately after the project is ready.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/[0.35] p-4">
                <p className="font-medium text-foreground">3. You land in the log view</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Redirect goes to the deployment detail route so you can watch build progress live.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-muted/[0.35] p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Default flow
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Most repositories only need the GitHub URL. Open the advanced section when you need a custom branch, root directory, install command, build command, or output directory.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-foreground">
              <span>GitHub URL</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span>first deployment</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span>logs</span>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
