import { PageShell } from "@/components/layout/page-shell"
import { Skeleton } from "@/components/ui/skeleton"

export default function NewProjectLoading() {
  return (
    <PageShell
      title="New Project"
      section="new"
      description="Connect a GitHub repository and launch your first static deployment."
    >
      <div
        className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]"
        aria-busy="true"
        aria-label="Loading new project form"
      >
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="space-y-2 border-b border-border px-6 py-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
          <div className="flex justify-end gap-2 border-t border-border bg-muted/25 px-6 py-4">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-36 rounded-md" />
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-6">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="size-5 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
