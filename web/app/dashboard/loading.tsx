import { PageShell } from "@/components/layout/page-shell"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <PageShell
      title="Projects"
      description="Manage connected repositories, trigger builds, and inspect deployment logs."
      actions={
        <>
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </>
      }
    >
      <div className="space-y-4" aria-busy="true" aria-label="Loading projects">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-18 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-40" />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <Skeleton className="h-5 w-60" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded-lg" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-14 rounded" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="hidden h-3 w-20 sm:block" />
                  <Skeleton className="size-6 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
