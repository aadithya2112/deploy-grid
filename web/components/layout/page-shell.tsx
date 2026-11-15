import type { ReactNode } from "react"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import {
  ChevronRight,
  FolderGit2,
  Grid2X2,
  Plus,
  Rocket,
  Settings2,
  UserRound,
} from "lucide-react"

import { ApiHealthCard } from "@/components/dashboard/api-health-card"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { isStaticPlatformEnabled } from "@/lib/static-platform"
import { isE2ETestMode } from "@/lib/test-mode"
import { cn } from "@/lib/utils"

interface PageShellProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  section?: "projects" | "new" | "project" | "deployment" | "releases"
  project?: { id: string; name: string }
}

const navigationClass =
  "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"

const activeNavigationClass =
  "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary dark:text-chart-2 dark:hover:text-chart-2"

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  section = "projects",
  project,
}: PageShellProps) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
      <a
        href="#workspace-content"
        className="sr-only fixed top-4 left-4 z-50 rounded-md bg-background px-4 py-2 text-sm focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside className="flex flex-col border-b border-border bg-sidebar px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-4 lg:py-7">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link
            href="/dashboard"
            className="flex w-fit items-center gap-2.5 px-2 font-heading text-lg font-semibold tracking-tight"
            aria-label="Deploy Grid home"
          >
            <Grid2X2
              className="size-8 rounded-lg bg-primary/10 p-1.5 text-primary dark:text-chart-2"
              aria-hidden="true"
            />
            Deploy Grid
          </Link>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>
        <nav
          aria-label="Workspace navigation"
          className="mt-5 flex flex-wrap gap-1 lg:mt-10 lg:flex-col"
        >
          <p className="mb-2 hidden px-3 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase lg:block">
            Workspace
          </p>
          <Link
            href="/dashboard"
            aria-current={section === "projects" ? "page" : undefined}
            className={cn(
              navigationClass,
              section === "projects" && activeNavigationClass
            )}
          >
            <FolderGit2 className="size-4" aria-hidden="true" /> Projects
          </Link>
          <Link
            href="/projects/new"
            aria-current={section === "new" ? "page" : undefined}
            className={cn(
              navigationClass,
              section === "new" && activeNavigationClass
            )}
          >
            <Plus className="size-4" aria-hidden="true" /> Create project
          </Link>
          {project ? (
            <div className="flex w-full flex-wrap gap-1 border-t border-border pt-3 lg:mt-6 lg:flex-col">
              <p
                className="mb-2 hidden truncate px-3 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase lg:block"
                title={project.name}
              >
                {project.name}
              </p>
              <Link
                href={`/projects/${project.id}`}
                aria-current={
                  section === "project" || section === "deployment"
                    ? "page"
                    : undefined
                }
                className={cn(
                  navigationClass,
                  (section === "project" || section === "deployment") &&
                    activeNavigationClass
                )}
              >
                <Rocket className="size-4" aria-hidden="true" /> Deployments
              </Link>
              <Link
                href={`/projects/${project.id}#configuration`}
                className={navigationClass}
              >
                <Settings2 className="size-4" aria-hidden="true" />{" "}
                Configuration
              </Link>
              {isStaticPlatformEnabled() ? (
                <Link
                  href={`/projects/${project.id}/manage`}
                  aria-current={section === "releases" ? "page" : undefined}
                  className={cn(
                    navigationClass,
                    section === "releases" && activeNavigationClass
                  )}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />{" "}
                  Releases
                </Link>
              ) : null}
            </div>
          ) : null}
        </nav>
        <div className="mt-auto hidden space-y-6 px-3 pt-10 lg:block">
          <ApiHealthCard />
          <div className="flex items-center gap-3 border-t border-border pt-5">
            {isE2ETestMode() ? (
              <UserRound
                className="size-7 rounded-full bg-primary/10 p-1.5 text-primary dark:text-chart-2"
                aria-hidden="true"
              />
            ) : (
              <UserButton />
            )}
            <span className="text-xs text-muted-foreground">
              Your workspace
            </span>
          </div>
        </div>
      </aside>
      <main id="workspace-content" className="min-w-0">
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 sm:px-8 lg:px-10">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/dashboard"
              className="shrink-0 transition-colors hover:text-foreground"
            >
              Workspace
            </Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            {project && section !== "project" ? (
              <>
                <Link
                  href={`/projects/${project.id}`}
                  className="truncate hover:text-foreground"
                >
                  {project.name}
                </Link>
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
              </>
            ) : null}
            <span className="truncate text-foreground">{title}</span>
          </nav>
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <div className="lg:hidden">
            {isE2ETestMode() ? (
              <UserRound
                className="size-5 text-muted-foreground"
                aria-label="Your workspace"
              />
            ) : (
              <UserButton />
            )}
          </div>
        </div>
        <div
          className={cn(
            "mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10",
            className
          )}
        >
          <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl min-w-0">
              <h1 className="font-heading text-3xl font-semibold tracking-tight wrap-break-word sm:text-[2rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 text-sm leading-6 wrap-break-word text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </header>
          <div className="workspace-enter min-w-0">{children}</div>
        </div>
      </main>
    </div>
  )
}
