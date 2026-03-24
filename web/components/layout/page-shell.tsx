import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageShellProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-7xl px-4 pb-10 pt-4 md:px-8 md:pb-14 md:pt-6",
        className
      )}
    >
      <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background/95 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_55%)]" />
        <header className="relative border-b border-border/70 px-5 py-5 md:px-8 md:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Deploy Grid
              </p>
              <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[2rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-[0.95rem]">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </header>
        <div className="relative p-5 md:p-8">{children}</div>
      </div>
    </main>
  )
}
