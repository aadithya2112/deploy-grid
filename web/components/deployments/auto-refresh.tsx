"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface DeploymentAutoRefreshProps {
  enabled: boolean
  intervalMs?: number
}

export function DeploymentAutoRefresh({
  enabled,
  intervalMs = 2000,
}: DeploymentAutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      router.refresh()
    }, intervalMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [enabled, intervalMs, router])

  return null
}
