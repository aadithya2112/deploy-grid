import type { DeploymentSnapshot, DeploymentStatus } from "@/lib/types"

export function formatBuildDuration(
  buildStartedAt: string | null,
  buildFinishedAt: string | null,
  status: DeploymentStatus
): string {
  if (buildStartedAt && buildFinishedAt) {
    const startMs = new Date(buildStartedAt).getTime()
    const endMs = new Date(buildFinishedAt).getTime()
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      const totalSeconds = Math.max(1, Math.round((endMs - startMs) / 1000))
      if (totalSeconds < 60) {
        return `${totalSeconds}s`
      }
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
    }
  }

  if (status === "building") return "Building…"
  if (status === "queued") return "Queued"
  return "—"
}

export function getDeploymentLiveUrl(
  deployment: Pick<DeploymentSnapshot, "previewUrl" | "artifactUrl">
): string | null {
  return deployment.previewUrl ?? deployment.artifactUrl ?? null
}

export function formatShortTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
