import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Grid2X2,
  History,
  ShieldCheck,
  Terminal,
} from "lucide-react"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"

const frameworks = ["React + Vite", "Next.js", "Astro", "Vue"]

const buildLogs = [
  {
    time: "09:14:02",
    step: "detect",
    message: "Vite + React detected (output: dist/)",
  },
  {
    time: "09:14:04",
    step: "cache",
    message: "Restored lockfile dependencies",
  },
  {
    time: "09:14:11",
    step: "build",
    message: "Compiled 42 static assets (1.8 MB)",
  },
  {
    time: "09:14:12",
    step: "edge",
    message: "Published immutable release snapshot",
  },
]

const capabilities = [
  {
    icon: ShieldCheck,
    title: "Isolated builds",
    description:
      "Every commit runs inside a restricted container with framework auto-detection and cached dependencies.",
  },
  {
    icon: Terminal,
    title: "Live build logs",
    description:
      "Inspect install, build, and upload output as it runs, with complete timestamped history per deployment.",
  },
  {
    icon: History,
    title: "Instant rollbacks",
    description:
      "Releases are stored as immutable snapshots so you can promote previews or revert production without rebuilding.",
  },
]

export default function LandingPage() {
  return (
    <div className="relative flex min-h-svh flex-col bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,oklch(0.511_0.096_186.391_/_0.11),transparent_72%)] dark:bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,oklch(0.704_0.14_182.503_/_0.12),transparent_72%)]"
      />

      <header className="relative z-10 border-b border-border/80 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-heading text-base font-semibold tracking-tight"
          >
            <Grid2X2
              className="size-8 rounded-lg bg-primary/10 p-1.5 text-primary dark:text-chart-2"
              aria-hidden="true"
            />
            <span>Deploy Grid</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 sm:px-8 md:py-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span
                className="size-1.5 rounded-full bg-primary dark:bg-chart-2"
                aria-hidden="true"
              />
              Static deployment platform
            </div>

            <h1 className="mt-6 font-heading text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]">
              Ship static sites straight from GitHub.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Connect a repository, follow isolated builds in real time, and
              promote verified releases to production with instant rollbacks.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-10 px-5">
                <Link href="/sign-in">
                  Open dashboard
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-10 px-5"
              >
                <Link href="/sign-up">Create account</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/80 pt-6 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Frameworks</span>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              {frameworks.map((framework, index) => (
                <span key={framework} className="inline-flex items-center gap-3">
                  <span className="font-mono text-[11px]">{framework}</span>
                  {index < frameworks.length - 1 ? (
                    <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="w-full">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_60px_-32px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="truncate font-heading text-sm font-medium text-foreground">
                    acme / marketing-site
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    <GitBranch className="size-3" aria-hidden="true" />
                    main
                  </span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <span
                    className="size-1.5 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                  Ready
                </span>
              </div>

              <div className="bg-muted/30 px-5 py-4 font-mono text-xs dark:bg-background/60">
                <div className="space-y-2.5">
                  {buildLogs.map((entry) => (
                    <div
                      key={entry.time + entry.step}
                      className="grid grid-cols-[62px_54px_minmax(0,1fr)] items-baseline gap-2.5 leading-5"
                    >
                      <span className="text-muted-foreground/70">
                        {entry.time}
                      </span>
                      <span className="text-primary dark:text-chart-2">
                        [{entry.step}]
                      </span>
                      <span className="text-foreground/90">
                        {entry.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] divide-x divide-border border-t border-border text-xs">
                <div className="px-5 py-3.5">
                  <p className="text-[11px] text-muted-foreground">
                    Production URL
                  </p>
                  <p className="mt-1 truncate font-mono text-foreground">
                    marketing.deploygrid.app
                  </p>
                </div>
                <div className="px-5 py-3.5">
                  <p className="text-[11px] text-muted-foreground">Release</p>
                  <div className="mt-1 flex items-center gap-2 font-mono text-foreground">
                    <span>f8c2a19</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2
                        className="size-3.5 text-primary dark:text-chart-2"
                        aria-hidden="true"
                      />
                      10.4s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Platform capabilities"
          className="border-t border-border/80"
        >
          <div className="mx-auto grid w-full max-w-6xl divide-y divide-border/80 px-6 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
            {capabilities.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="py-8 md:px-8 md:py-10 md:first:pl-0 md:last:pr-0"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className="size-4 text-primary dark:text-chart-2"
                      aria-hidden="true"
                    />
                    <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h2>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 text-xs text-muted-foreground sm:px-8">
          <p>Deploy Grid · Static site hosting &amp; release management</p>
          <div className="flex items-center gap-5">
            <Link
              href="/sign-in"
              className="transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="transition-colors hover:text-foreground"
            >
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
