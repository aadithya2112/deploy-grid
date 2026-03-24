import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, ChevronRight, Github, TerminalSquare } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAuth } from "@/lib/auth"

export default async function LandingPage() {
  const { userId } = await getAuth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.09),transparent_38%),linear-gradient(to_bottom,transparent,rgba(15,23,42,0.02))] px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-7xl flex-col rounded-[32px] border border-border/70 bg-background/95 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-2xl border border-border/70 bg-muted/60">
              <TerminalSquare className="size-4" />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold tracking-tight">
                Deploy Grid
              </p>
              <p className="text-xs text-muted-foreground">
                GitHub URL in. Build logs out.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-up">Create account</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-in">
                Sign in
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid flex-1 gap-10 px-5 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] md:px-8 md:py-14">
          <div className="flex max-w-2xl flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-700">
            <Badge
              variant="outline"
              className="w-fit rounded-full border-border/70 bg-background/70 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              Operator-first deployments
            </Badge>
            <h1 className="mt-6 max-w-xl font-heading text-4xl font-semibold tracking-[-0.04em] text-foreground md:text-6xl">
              Deploy repos with the calm, traceable feel of a Vercel build log.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
              Sign in with Clerk, drop in a GitHub URL, and move straight into a
              live deployment view with status, timestamps, and worker logs.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/sign-in">
                  Open dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-5">
                <Link href="/sign-up">
                  <Github className="size-4" />
                  Start with Clerk
                </Link>
              </Button>
            </div>
            <div className="mt-10 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
              <div className="border-l border-border/70 pl-4">
                <p className="font-medium text-foreground">Project creation</p>
                <p className="mt-1 leading-6">
                  One URL creates or reuses the project and starts the first deployment.
                </p>
              </div>
              <div className="border-l border-border/70 pl-4">
                <p className="font-medium text-foreground">Live build logs</p>
                <p className="mt-1 leading-6">
                  Deployment status and logs refresh while the worker is building.
                </p>
              </div>
              <div className="border-l border-border/70 pl-4">
                <p className="font-medium text-foreground">User-scoped access</p>
                <p className="mt-1 leading-6">
                  Every project and deployment stays scoped to the signed-in Clerk user.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 md:justify-end">
            <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-border/70 bg-[#0f1115] shadow-[0_24px_80px_-36px_rgba(15,23,42,0.65)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  deployment-ready
                </div>
                <span>build logs</span>
              </div>
              <div className="space-y-4 px-4 py-5 font-mono text-xs text-zinc-200">
                <div className="space-y-2">
                  <p className="text-zinc-500">$ deploy-grid create https://github.com/acme/edge-store.git</p>
                  <p>#1 [system] repository cloned</p>
                  <p>#2 [stdout] bun install</p>
                  <p>#3 [stdout] bun run build</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">edge-store</p>
                      <p className="mt-1 text-zinc-400">Production build is healthy and ready to inspect.</p>
                    </div>
                    <Badge className="rounded-full bg-emerald-500/12 px-3 text-emerald-300 hover:bg-emerald-500/12">
                      ready
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        Commit
                      </p>
                      <p className="mt-2 text-zinc-100">abc123def456</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        Preview
                      </p>
                      <p className="mt-2 text-zinc-100">edge-store-preview.vercel.app</p>
                    </div>
                  </div>
                </div>
                <p className="text-zinc-500">
                  Press <span className="rounded bg-white/8 px-1.5 py-0.5 text-zinc-200">d</span> to toggle theme in the app.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
