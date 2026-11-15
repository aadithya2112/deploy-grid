import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Rocket } from "lucide-react"

import { createProjectAndDeployAction } from "@/app/projects/actions"
import { ProjectCreateFields } from "@/components/projects/project-create-fields"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { getAuth } from "@/lib/auth"

export default async function NewProjectPage() {
  const { userId } = await getAuth()
  if (!userId) redirect("/sign-in")

  return (
    <PageShell
      title="New Project"
      section="new"
      description="Connect a repository and start your first deployment."
    >
      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_250px]">
        <form
          action={createProjectAndDeployAction}
          className="min-w-0 space-y-6"
        >
          <div className="mb-7 border-b border-border pb-5">
            <h2 className="text-sm font-medium">Repository</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Paste the GitHub URL. Custom build settings are optional.
            </p>
          </div>
          <ProjectCreateFields />
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-6">
            <Button asChild variant="ghost">
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <Button type="submit">
              Create and deploy <Rocket className="size-4" />
            </Button>
          </div>
        </form>
        <aside className="xl:border-l xl:border-border xl:pl-7">
          <h2 className="text-sm font-medium">What happens next</h2>
          <ol className="mt-6 space-y-7">
            {[
              [
                "Connect the repository",
                "Create a project or reuse an existing repository in your workspace.",
              ],
              [
                "Build your site",
                "Install dependencies and run the project's build command.",
              ],
              [
                "Follow the deployment",
                "Open the live log to check progress and access the published output.",
              ],
            ].map(([title, description], index) => (
              <li key={title} className="flex gap-3">
                <span className="pt-0.5 font-mono text-xs text-primary">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="text-xs font-medium">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/dashboard"
            className="mt-9 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Back to projects <ArrowRight className="size-3" />
          </Link>
        </aside>
      </div>
    </PageShell>
  )
}
