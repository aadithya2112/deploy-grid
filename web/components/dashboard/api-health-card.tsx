"use client"

import { useEffect, useState } from "react"

import type { HealthSnapshot } from "@/lib/types"

interface HealthRouteResponse {
  apiBaseUrl: string
  health: HealthSnapshot
}

interface HealthCardState {
  apiBaseUrl: string | null
  error: string | null
  health: HealthSnapshot | null
  isLoading: boolean
}

const initialState: HealthCardState = {
  apiBaseUrl: null,
  error: null,
  health: null,
  isLoading: true,
}

export function ApiHealthCard() {
  const [state, setState] = useState<HealthCardState>(initialState)

  useEffect(() => {
    const controller = new AbortController()

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          let message = `Request failed with ${response.status}`

          try {
            const body = (await response.json()) as { error?: string }
            if (body.error) {
              message = body.error
            }
          } catch {
            // Keep the fallback message when the response is not valid JSON.
          }

          throw new Error(message)
        }

        const body = (await response.json()) as HealthRouteResponse

        setState({
          apiBaseUrl: body.apiBaseUrl,
          error: null,
          health: body.health,
          isLoading: false,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setState({
          apiBaseUrl: null,
          error:
            error instanceof Error ? error.message : "Unable to load health",
          health: null,
          isLoading: false,
        })
      }
    }

    void loadHealth()

    return () => controller.abort()
  }, [])

  const connected = state.health?.status === "ok"

  return (
    <div aria-live="polite" aria-label="API connection" className="text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`size-1.5 shrink-0 rounded-full ${state.isLoading ? "bg-muted-foreground/50" : connected ? "bg-primary dark:bg-chart-2" : "bg-destructive"}`}
          aria-hidden="true"
        />
        <span>
          {state.isLoading
            ? "Checking connection…"
            : connected
              ? "API connected"
              : "API unavailable"}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        {state.isLoading
          ? "Checking service health"
          : connected
            ? "Database connected"
            : "Refresh to check again"}
      </p>
    </div>
  )
}
