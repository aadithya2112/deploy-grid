"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
          error: error instanceof Error ? error.message : "Unable to load health",
          health: null,
          isLoading: false,
        })
      }
    }

    void loadHealth()

    return () => controller.abort()
  }, [])

  return (
    <div className="rounded-[24px] border border-border/70 bg-muted/[0.35] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            API health
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            Live status from /health.
          </h3>
        </div>
        <Activity className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-6 space-y-3">
        {state.isLoading ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3">
                Checking...
              </Badge>
            </div>
            <p className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2 font-mono text-xs text-muted-foreground">
              Loading API endpoint
            </p>
          </>
        ) : state.health ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={state.health.status === "ok" ? "default" : "destructive"}
                className="rounded-full px-3"
              >
                {state.health.status}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3">
                Database: {state.health.database}
              </Badge>
            </div>
            <p className="rounded-2xl border border-border/70 bg-background/80 px-3 py-2 font-mono text-xs text-muted-foreground">
              {state.apiBaseUrl}
            </p>
          </>
        ) : (
          <p className="text-sm text-destructive">
            {state.error ?? "Unable to load health"}
          </p>
        )}
      </div>
    </div>
  )
}
