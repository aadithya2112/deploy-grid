import type { ReactNode } from "react"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import {
  ChevronRight,
  FolderGit2,
  Grid2X2,
  Layers,
  Plus,
  Rocket,
  Settings2,
  UserRound,
} from "lucide-react"

import { ApiHealthCard } from "@/components/dashboard/api-health-card"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator"
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
  "flex min-h-9 items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground motion-reduce:transition-none"

const activeNavigationClass =
  "bg-primary/10 font-medium text-primary hover:bg-primary/12 hover:text-primary dark:text-chart-2 dark:hover:text-chart-2"

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
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a
        href="#workspace-content"
        className="sr-only fixed top-4 left-4 z-50 rounded-md bg-background px-4 py-2 text-sm focus:not-sr-only"
      >
        Skip to content
      </a>

      <aside className="flex flex-col border-b border-border bg-sidebar/80 px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-3.5 lg:py-5">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Link
            href="/dashboard"
            className="flex w-fit items-center gap-2.5 rounded-lg px-2 py-1 font-heading text-base font-semibold tracking-tight transition-opacity hover:opacity-90"
            aria-label="Deploy Grid home"
          >
            <Grid2X2
              className="size-8 rounded-lg bg-primary/10 p-1.5 text-primary dark:text-chart-2"
              aria-hidden="true"
            />
            <span>Deploy Grid</span>
          </Link>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>

        <nav
          aria-label="Workspace navigation"
          className="mt-4 flex flex-wrap gap-1 lg:mt-7 lg:flex-col"
        >
          <p className="mb-1.5 hidden px-3 text-[10px] font-medium tracking-[0.16em] text-muted-foreground/80 uppercase lg:block">
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
            <span className="flex items-center gap-2.5">
              <FolderGit2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Projects</span>
            </span>
            <LinkPendingIndicator />
          </Link>
          <Link
            href="/projects/new"
            aria-current={section === "new" ? "page" : undefined}
            className={cn(
              navigationClass,
              section === "new" && activeNavigationClass
            )}
          >
            <span className="flex items-center gap-2.5">
              <Plus className="size-4 shrink-0" aria-hidden="true" />
              <span>Create project</span>
            </span>
            <LinkPendingIndicator />
          </Link>

          {project ? (
            <div className="mt-2 flex w-full flex-wrap gap-1 border-t border-border pt-3 lg:mt-5 lg:flex-col lg:pt-5">
              <p
                className="mb-1.5 hidden truncate px-3 text-[10px] font-medium tracking-[0.14em] text-muted-foreground/80 uppercase lg:block"
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
                <span className="flex items-center gap-2.5">
                  <Rocket className="size-4 shrink-0" aria-hidden="true" />
                  <span>Deployments</span>
                </span>
                <LinkPendingIndicator />
              </Link>
              <Link
                href={`/projects/${project.id}#configuration`}
                className={navigationClass}
              >
                <span className="flex items-center gap-2.5">
                  <Settings2 className="size-4 shrink-0" aria-hidden="true" />
                  <span>Configuration</span>
                </span>
                <LinkPendingIndicator />
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
                  <span className="flex items-center gap-2.5">
                    <Layers className="size-4 shrink-0" aria-hidden="true" />
                    <span>Releases</span>
                  </span>
                  <LinkPendingIndicator />
                </Link>
              ) : null}
            </div>
          ) : null}
        </nav>

        <div className="mt-auto hidden space-y-4 px-1 pt-8 lg:block">
          <ApiHealthCard />
          <div className="flex items-center gap-3 border-t border-border px-2 pt-4">
            {isE2ETestMode() ? (
              <UserRound
                className="size-7 rounded-full bg-primary/10 p-1.5 text-primary dark:text-chart-2"
                aria-hidden="true"
              />
            ) : (
              <UserButton />
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                Your workspace
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Personal account
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main id="workspace-content" className="min-w-0">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-5 backdrop-blur-sm sm:px-8 lg:px-10">
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
                  className="truncate transition-colors hover:text-foreground"
                >
                  {project.name}
                </Link>
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
              </>
            ) : null}
            <span className="truncate font-medium text-foreground">
              {title}
            </span>
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
            "mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:px-10 lg:py-9",
            className
          )}
        >
          <header className="mb-7 flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-6">
            <div className="max-w-2xl min-w-0">
              <h1 className="font-heading text-2xl font-semibold tracking-tight wrap-break-word sm:text-[1.75rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-1.5 text-sm leading-6 wrap-break-word text-muted-foreground">
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
