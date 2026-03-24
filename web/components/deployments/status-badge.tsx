import { Badge } from "@/components/ui/badge"
import type { DeploymentStatus } from "@/lib/types"

const statusVariantMap: Record<
  DeploymentStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  building: "outline",
  ready: "default",
  failed: "destructive",
  cancelled: "secondary",
}

export function DeploymentStatusBadge({
  status,
}: {
  status: DeploymentStatus
}) {
  return (
    <Badge variant={statusVariantMap[status]} className="capitalize">
      {status}
    </Badge>
  )
}
