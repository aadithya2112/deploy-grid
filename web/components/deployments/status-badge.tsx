import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DeploymentStatus } from "@/lib/types"

const statusClassMap: Record<DeploymentStatus, string> = {
  queued:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  building:
    "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  ready:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed:
    "border-destructive/20 bg-destructive/10 text-destructive dark:text-destructive",
  cancelled:
    "border-border bg-muted text-muted-foreground dark:bg-muted/60",
}

const statusDotClassMap: Record<DeploymentStatus, string> = {
  queued: "bg-amber-500",
  building: "bg-sky-500",
  ready: "bg-emerald-500",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground/60",
}

export function DeploymentStatusBadge({
  status,
}: {
  status: DeploymentStatus
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize",
        statusClassMap[status]
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", statusDotClassMap[status])}
      />
      {status}
    </Badge>
  )
}
