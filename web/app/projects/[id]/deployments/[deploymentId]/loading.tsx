import { PageShell } from "@/components/layout/page-shell"
import { Skeleton } from "@/components/ui/skeleton"

export default function DeploymentDetailLoading() {
  return (
    <PageShell
      section="deployment"
      title="Loading deployment…"
      description="Fetching deployment status and build output."
      actions={
        <>
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </>
      }
    >
      <div
        className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_280px]"
        aria-busy="true"
        aria-label="Loading deployment logs"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-[#0f1115] p-5">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-3.5 bg-white/10"
                  style={{ width: `${55 + ((index * 17) % 40)}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
